import axios, { AxiosRequestConfig } from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import { ProxyResolver, ProxyType } from "../shared/proxy.types";

export interface BankFetchOptions {
  responseType?: "arraybuffer" | "json" | "text";
  headers?: Record<string, string>;
  timeoutMs?: number;
  validateStatus?: (status: number) => boolean;
}

export interface BrowserFetchOptions {
  waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
  waitForSelector?: string;
  timeoutMs?: number;
}

/**
 * FetchError is thrown when all retry attempts are exhausted.
 * Catch this in your service layer to handle network failures gracefully.
 */
export class FetchError extends Error {
  constructor(
    public readonly url: string,
    public readonly countryCode: string,
    public readonly cause: unknown,
  ) {
    const reason =
      cause instanceof Error ? cause.message : "Unknown network error";
    super(`Fetch failed for ${countryCode} — ${url}: ${reason}`);
    this.name = "FetchError";
  }
}

/**
 * BankFetchService — single HTTP gateway for all bank parsers.
 *
 * Parsers never call axios directly. They call this service, which
 * handles proxy routing, retries, and timeouts transparently.
 *
 * Usage:
 *   const fetcher = new BankFetchService(myProxyResolver);
 *   const { data } = await fetcher.fetch(url, 'ET', { responseType: 'text' });
 *
 * @param proxyResolver  Implement ProxyResolver in your host app to provide
 *                       proxy config from your database or config store.
 *                       Pass null to disable proxy support entirely.
 */
export class BankFetchService {
  private readonly MAX_RETRIES = 2;
  private readonly DEFAULT_TIMEOUT_MS = 10_000;

  constructor(private readonly proxyResolver: ProxyResolver | null = null) {}

  async fetch(
    url: string,
    countryCode: string,
    options: BankFetchOptions = {},
  ): Promise<{ data: any; status: number; headers: any }> {
    const proxy = (await this.proxyResolver?.resolve(countryCode)) ?? null;
    const timeoutMs = options.timeoutMs ?? this.DEFAULT_TIMEOUT_MS;

    let lastError: unknown;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const config: AxiosRequestConfig = {
          url,
          method: "GET",
          responseType: options.responseType ?? "text",
          headers: options.headers ?? {},
          timeout: timeoutMs,
          validateStatus: options.validateStatus,
        };

        if (proxy?.enabled && proxy.url) {
          config.httpsAgent =
            proxy.type === ProxyType.SOCKS5
              ? new SocksProxyAgent(proxy.url)
              : new HttpsProxyAgent(proxy.url);
          config.proxy = false;
        }

        const response = await axios(config);
        return {
          data: response.data,
          status: response.status,
          headers: response.headers,
        };
      } catch (err) {
        lastError = err;
        if (attempt < this.MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 1_000));
        }
      }
    }

    throw new FetchError(url, countryCode, lastError);
  }

  async fetchBrowserPage(
    url: string,
    countryCode: string,
    options: BrowserFetchOptions = {},
  ): Promise<{ data: string }> {
    const proxy = (await this.proxyResolver?.resolve(countryCode)) ?? null;
    const timeoutMs = options.timeoutMs ?? 60_000;
    const args = ["--no-sandbox", "--disable-setuid-sandbox"];

    if (proxy?.enabled && proxy.url) {
      args.push(`--proxy-server=${proxy.url}`);
    }

    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.default.launch({
      headless: true,
      args,
    });

    try {
      const page = await browser.newPage();
      await page.goto(url, {
        waitUntil: options.waitUntil ?? "domcontentloaded",
        timeout: timeoutMs,
      });

      if (options.waitForSelector) {
        await page
          .waitForSelector(options.waitForSelector, { timeout: timeoutMs })
          .catch(() => {});
      }

      return { data: await page.content() };
    } finally {
      await browser.close();
    }
  }
}
