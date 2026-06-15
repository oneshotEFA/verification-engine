"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EBirrParser = void 0;
const jsdom_1 = require("jsdom");
const bank_fetch_service_1 = require("../../core/bank-fetch.service");
class EBirrParser {
    constructor() {
        this.fallbackFetcher = new bank_fetch_service_1.BankFetchService();
    }
    extract(sms, _accountNumber) {
        const text = this.cleanText(sms);
        const match = text.match(/https:\/\/transactioninfo\.ebirr\.com\/[\w-]+\/receipt\/([A-Z0-9]{8,})/i);
        if (!match)
            return { link: "" };
        return {
            link: `https://transactioninfo.ebirr.com/kaafimf-Ebirr/receipt/${match[1]}`,
        };
    }
    transactionRef(transactionRef) {
        const trx = transactionRef.replace(/[^A-Z0-9]/gi, "").toUpperCase();
        return {
            link: `https://transactioninfo.ebirr.com/kaafimf-Ebirr/receipt/${trx}`,
        };
    }
    async fetch(link, context) {
        if (!link)
            throw new Error("No link provided");
        const fetcher = context?.fetcher ?? this.fallbackFetcher;
        const response = await fetcher.fetch(link, context?.countryCode ?? "ET", {
            timeoutMs: 30000,
        });
        return { page: response.data };
    }
    async receiptParser(html) {
        const dom = new jsdom_1.JSDOM(html);
        const document = dom.window.document;
        const getValueByLabel = (label) => {
            const cells = Array.from(document.querySelectorAll("td.invoice"));
            const labelCell = cells.find((td) => td.textContent?.trim().toUpperCase().includes(label));
            if (!labelCell)
                return "";
            const valueCell = labelCell.nextElementSibling;
            return (valueCell?.textContent?.trim() ?? "").replace(/ETB/gi, "").trim();
        };
        const headings = Array.from(document.querySelectorAll("div.heading"));
        const receiverDiv = headings.find((div) => div.textContent?.includes("Receiver Info"));
        let receiverName = "";
        let receiverAccount = "";
        if (receiverDiv) {
            const table = receiverDiv.nextElementSibling;
            const rows = Array.from(table?.querySelectorAll("tr") ?? []);
            receiverName = rows[1]?.textContent?.trim() ?? "";
            receiverAccount = rows[3]?.textContent?.trim() ?? "";
        }
        return {
            bank: "EBIRR",
            receipt: {
                date: getValueByLabel("DATE"),
                transactionNumber: getValueByLabel("RECEIPT NO"),
                amount: getValueByLabel("AMOUNT"),
                receiverName,
                receiverAccount,
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
exports.EBirrParser = EBirrParser;
//# sourceMappingURL=ebirr.parser.js.map