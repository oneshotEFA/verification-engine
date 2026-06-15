"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbyssiniaParser = void 0;
const jsdom_1 = require("jsdom");
const bank_fetch_service_1 = require("../../core/bank-fetch.service");
class AbyssiniaParser {
    constructor() {
        this.fallbackFetcher = new bank_fetch_service_1.BankFetchService();
    }
    extract(sms, accNumber) {
        const cleaned = sms.replace(/hitps/gi, "https").replace(/\s+/g, " ").trim();
        const urlMatch = cleaned.match(/trx\s*=\s*([A-Z0-9]{8,})/i);
        if (urlMatch)
            return { link: this.buildLink(urlMatch[1], accNumber) };
        const ocrMatch = cleaned.match(/Transaction\s+(?:Reference\s+)?([A-Z]{2}\d{5}[A-Z0-9]+)/i);
        if (ocrMatch)
            return { link: this.buildLink(ocrMatch[1], accNumber) };
        const refMatch = cleaned.match(/\b(FT\d{5}[A-Z0-9]{4,})\b/i);
        if (refMatch)
            return { link: this.buildLink(refMatch[1], accNumber) };
        return { link: "" };
    }
    transactionRef(transactionRef, accountNumber) {
        return { link: this.buildLink(transactionRef, accountNumber) };
    }
    async fetch(link, context) {
        if (!link)
            throw new Error("No link provided");
        const fetcher = context?.fetcher ?? this.fallbackFetcher;
        const response = await fetcher.fetchBrowserPage(link, context?.countryCode ?? "ET", {
            waitUntil: "networkidle2",
            waitForSelector: "table",
            timeoutMs: 60000,
        });
        return { page: response.data };
    }
    async receiptParser(html) {
        const dom = new jsdom_1.JSDOM(html);
        const document = dom.window.document;
        const rows = Array.from(document.querySelectorAll("table tr"));
        const result = {};
        rows.forEach((row) => {
            const cells = Array.from(row.querySelectorAll("td"));
            if (cells.length < 2)
                return;
            const label = cells[0].textContent?.trim().toLowerCase() ?? "";
            const value = cells[1].textContent?.trim() ?? "";
            if (label.includes("receiver's account"))
                result.receiverAccount = value;
            if (label.includes("receiver's name"))
                result.receiverName = value;
            if (label.includes("transferred amount"))
                result.amount = value;
            if (label.includes("transaction date"))
                result.date = value;
            if (label.includes("transaction reference"))
                result.transactionNumber = value;
        });
        return {
            bank: "ABYSSINIA",
            receipt: {
                date: result.date ?? "",
                receiverAccount: result.receiverAccount ?? "",
                receiverName: result.receiverName ?? "",
                amount: (result.amount ?? "").replace(/^ETB\s*/i, "").trim(),
                transactionNumber: result.transactionNumber ?? "",
            },
        };
    }
    buildLink(trx, accountNumber) {
        const upper = trx.replace(/[^A-Z0-9]/gi, "").toUpperCase();
        if (upper.length === 12 && accountNumber && accountNumber.length >= 5) {
            return `https://cs.bankofabyssinia.com/slip/?trx=${upper}${accountNumber.slice(-5)}`;
        }
        return `https://cs.bankofabyssinia.com/slip/?trx=${upper}`;
    }
}
exports.AbyssiniaParser = AbyssiniaParser;
//# sourceMappingURL=abyssinia.parser.js.map