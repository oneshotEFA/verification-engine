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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelebirrParser = void 0;
const cheerio = __importStar(require("cheerio"));
const bank_fetch_service_1 = require("../../core/bank-fetch.service");
class TelebirrParser {
    constructor() {
        this.fallbackFetcher = new bank_fetch_service_1.BankFetchService();
    }
    extract(text, _accountNumber) {
        if (!text)
            return { link: "" };
        const cleaned = this.cleanText(text);
        const txnNumberMatch = cleaned.match(/your transaction number is\s+([A-Z0-9]{8,12})/i);
        if (txnNumberMatch) {
            const trx = txnNumberMatch[1].replace(/[^A-Z0-9]/gi, "").toUpperCase();
            return { link: `https://transactioninfo.ethiotelecom.et/receipt/${trx}` };
        }
        const appShareMatch = cleaned.match(/Transaction\s+Number\s*[:\-]?\s*([A-Z0-9]{8,12})(?:\s|$|[^A-Z0-9])/i);
        if (appShareMatch) {
            const trx = appShareMatch[1].replace(/[^A-Z0-9]/gi, "").toUpperCase();
            return { link: `https://transactioninfo.ethiotelecom.et/receipt/${trx}` };
        }
        const rawMatch = text.match(/your transaction number is\s+([A-Z0-9]{8,12})/i);
        if (rawMatch) {
            const trx = rawMatch[1].replace(/[^A-Z0-9]/gi, "").toUpperCase();
            return { link: `https://transactioninfo.ethiotelecom.et/receipt/${trx}` };
        }
        return { link: "" };
    }
    transactionRef(transactionRef) {
        const trx = transactionRef.replace(/[^A-Z0-9]/gi, "").toUpperCase();
        return { link: `https://transactioninfo.ethiotelecom.et/receipt/${trx}` };
    }
    async fetch(link, context) {
        if (!link)
            throw new Error("No link provided");
        const fetcher = context?.fetcher ?? this.fallbackFetcher;
        const response = await fetcher.fetchBrowserPage(link, context?.countryCode ?? "ET", {
            waitUntil: "domcontentloaded",
            waitForSelector: "table",
            timeoutMs: 60000,
        });
        return { page: response.data };
    }
    async receiptParser(html) {
        const $ = cheerio.load(html);
        let transactionRow;
        $("tr").each((_, tr) => {
            const tds = $(tr).find("td");
            if (tds.length === 3) {
                const tx = tds.eq(0).text().trim();
                if (/^[A-Z0-9]{8,12}$/.test(tx)) {
                    transactionRow = tds;
                }
            }
        });
        if (!transactionRow) {
            throw new Error("Invalid Telebirr receipt: transaction row not found");
        }
        const extractByLabel = (label) => $("td")
            .filter((_, el) => $(el).text().includes(label))
            .next("td")
            .text()
            .trim();
        return {
            bank: "TELEBIRR",
            receipt: {
                transactionNumber: transactionRow.eq(0).text().trim(),
                date: transactionRow.eq(1).text().trim(),
                amount: transactionRow
                    .eq(2)
                    .text()
                    .trim()
                    .replace(/[^\d.]/g, ""),
                receiverName: extractByLabel("Credited Party name"),
                receiverAccount: extractByLabel("Credited party account no"),
            },
        };
    }
    cleanText(text) {
        return text
            .replace(/\s+/g, " ")
            .replace(/https:\s*\/\//gi, "https://")
            .replace(/\s*\/\s*/g, "/")
            .trim();
    }
}
exports.TelebirrParser = TelebirrParser;
//# sourceMappingURL=telebirr.parser.js.map