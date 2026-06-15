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
exports.VerificationEngine = void 0;
const parsers_1 = require("../parsers");
const bank_fetch_service_1 = require("./bank-fetch.service");
/**
 * VerificationEngine — the main entry point for the package.
 *
 * Plain TypeScript class. No NestJS, no Prisma, no framework.
 *
 * Usage:
 *
 *   // Minimal — no proxy support
 *   const engine = new VerificationEngine();
 *
 *   // With proxy support — implement ProxyResolver in your app
 *   const engine = new VerificationEngine({ proxyResolver: myResolver });
 *
 *   // With custom parsers (extend or override)
 *   const engine = new VerificationEngine({ parsers: { ...PARSER_REGISTRY, MY_BANK: new MyParser() } });
 *
 *   const result = await engine.verify({
 *     bank: 'CBE',
 *     amount: 500,
 *     verMethod: 'LINK',
 *     rawProof: 'https://apps.cbe.com.et:100/?id=FT26093JCD3218872366',
 *   });
 */
class VerificationEngine {
    constructor(options) {
        this.fetcher = new bank_fetch_service_1.BankFetchService(options?.proxyResolver ?? null);
        this.parsers = options?.parsers ?? parsers_1.PARSER_REGISTRY;
        this.ocrReader = options?.ocrReader ?? readTextWithTesseract;
    }
    async verify(payload) {
        const parser = this.parsers[payload.bank];
        const countryCode = payload.countryCode ?? "ET";
        if (!parser) {
            return {
                status: "FAIL",
                reason: `No parser registered for bank: ${payload.bank}`,
            };
        }
        try {
            let link;
            switch (payload.verMethod) {
                case "LINK":
                    if (typeof payload.rawProof !== "string") {
                        return {
                            status: "FAIL",
                            reason: "LINK verification requires rawProof to be a URL string",
                        };
                    }
                    link = payload.rawProof;
                    break;
                case "SMS":
                    if (typeof payload.rawProof !== "string") {
                        return {
                            status: "FAIL",
                            reason: "SMS verification requires rawProof to be text",
                        };
                    }
                    link = parser.extract(payload.rawProof, payload.accountNumber).link;
                    if (!link)
                        return {
                            status: "FAIL",
                            reason: "Could not extract link from SMS",
                        };
                    break;
                case "TRANSACTION_REF":
                    if (typeof payload.rawProof !== "string") {
                        return {
                            status: "FAIL",
                            reason: "TRANSACTION_REF verification requires rawProof to be a transaction reference string",
                        };
                    }
                    link = (parser.transactionRef?.(payload.rawProof, payload.accountNumber) ??
                        parser.extract(payload.rawProof, payload.accountNumber)).link;
                    if (!link)
                        return {
                            status: "FAIL",
                            reason: "Could not build link from transaction reference",
                        };
                    break;
                case "OCR":
                case "SCREENSHOT":
                    {
                        const text = await this.ocrReader(payload.rawProof);
                        link = parser.extract(text, payload.accountNumber).link;
                    }
                    if (!link)
                        return {
                            status: "FAIL",
                            reason: "Could not extract link from OCR result",
                        };
                    break;
                default:
                    return {
                        status: "FAIL",
                        reason: `Unsupported verification method: ${payload.verMethod}`,
                    };
            }
            const fetched = await parser.fetch(link, {
                fetcher: this.fetcher,
                countryCode,
            });
            const receipt = await parser.receiptParser(fetched.page);
            if (!receipt?.receipt) {
                return { status: "FAIL", reason: "Parser returned no receipt data" };
            }
            if (!amountsMatch(payload.amount, receipt.receipt.amount, payload.amountTolerance)) {
                return {
                    status: "FAIL",
                    reason: `Receipt amount ${receipt.receipt.amount || "(empty)"} does not match expected amount ${payload.amount}`,
                };
            }
            return { status: "SUCCESS", receipt };
        }
        catch (err) {
            return {
                status: "FAIL",
                reason: err instanceof Error
                    ? err.message
                    : "Unexpected error during verification",
            };
        }
    }
    /** List all registered parser keys */
    getSupportedBanks() {
        return Object.keys(this.parsers);
    }
}
exports.VerificationEngine = VerificationEngine;
const readTextWithTesseract = async (input) => {
    const { recognize } = await Promise.resolve().then(() => __importStar(require("tesseract.js")));
    const result = await recognize(input, "eng");
    return result.data.text ?? "";
};
const parseAmount = (value) => {
    const normalized = value
        .toString()
        .replace(/[^\d.-]/g, "")
        .trim();
    if (!normalized)
        return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
};
const amountsMatch = (expected, actual, tolerance = 0.01) => {
    const parsedActual = parseAmount(actual);
    if (parsedActual === null)
        return false;
    return Math.abs(parsedActual - expected) <= tolerance;
};
//# sourceMappingURL=verification-engine.js.map