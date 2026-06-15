import { ProxyResolver } from "../shared/proxy.types";
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
export declare class FetchError extends Error {
    readonly url: string;
    readonly countryCode: string;
    readonly cause: unknown;
    constructor(url: string, countryCode: string, cause: unknown);
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
export declare class BankFetchService {
    private readonly proxyResolver;
    private readonly MAX_RETRIES;
    private readonly DEFAULT_TIMEOUT_MS;
    constructor(proxyResolver?: ProxyResolver | null);
    fetch(url: string, countryCode: string, options?: BankFetchOptions): Promise<{
        data: any;
        status: number;
        headers: any;
    }>;
    fetchBrowserPage(url: string, countryCode: string, options?: BrowserFetchOptions): Promise<{
        data: string;
    }>;
}
//# sourceMappingURL=bank-fetch.service.d.ts.map