"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BankFetchService = exports.FetchError = void 0;
const axios_1 = __importDefault(require("axios"));
const https_proxy_agent_1 = require("https-proxy-agent");
const socks_proxy_agent_1 = require("socks-proxy-agent");
const proxy_types_1 = require("../shared/proxy.types");
/**
 * FetchError is thrown when all retry attempts are exhausted.
 * Catch this in your service layer to handle network failures gracefully.
 */
class FetchError extends Error {
    constructor(url, countryCode, cause) {
        const reason = cause instanceof Error ? cause.message : "Unknown network error";
        super(`Fetch failed for ${countryCode} — ${url}: ${reason}`);
        this.url = url;
        this.countryCode = countryCode;
        this.cause = cause;
        this.name = "FetchError";
    }
}
exports.FetchError = FetchError;
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
class BankFetchService {
    constructor(proxyResolver = null) {
        this.proxyResolver = proxyResolver;
        this.MAX_RETRIES = 2;
        this.DEFAULT_TIMEOUT_MS = 10000;
    }
    async fetch(url, countryCode, options = {}) {
        const proxy = (await this.proxyResolver?.resolve(countryCode)) ?? null;
        const timeoutMs = options.timeoutMs ?? this.DEFAULT_TIMEOUT_MS;
        let lastError;
        for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
            try {
                const config = {
                    url,
                    method: "GET",
                    responseType: options.responseType ?? "text",
                    headers: options.headers ?? {},
                    timeout: timeoutMs,
                    validateStatus: options.validateStatus,
                };
                if (proxy?.enabled && proxy.url) {
                    config.httpsAgent =
                        proxy.type === proxy_types_1.ProxyType.SOCKS5
                            ? new socks_proxy_agent_1.SocksProxyAgent(proxy.url)
                            : new https_proxy_agent_1.HttpsProxyAgent(proxy.url);
                    config.proxy = false;
                }
                const response = await (0, axios_1.default)(config);
                return {
                    data: response.data,
                    status: response.status,
                    headers: response.headers,
                };
            }
            catch (err) {
                lastError = err;
                if (attempt < this.MAX_RETRIES) {
                    await new Promise((r) => setTimeout(r, 1000));
                }
            }
        }
        throw new FetchError(url, countryCode, lastError);
    }
    async fetchBrowserPage(url, countryCode, options = {}) {
        const proxy = (await this.proxyResolver?.resolve(countryCode)) ?? null;
        const timeoutMs = options.timeoutMs ?? 60000;
        const args = ["--no-sandbox", "--disable-setuid-sandbox"];
        if (proxy?.enabled && proxy.url) {
            args.push(`--proxy-server=${proxy.url}`);
        }
        const puppeteer = await Promise.resolve().then(() => __importStar(require("puppeteer")));
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
                    .catch(() => { });
            }
            return { data: await page.content() };
        }
        finally {
            await browser.close();
        }
    }
}
exports.BankFetchService = BankFetchService;
//# sourceMappingURL=bank-fetch.service.js.map