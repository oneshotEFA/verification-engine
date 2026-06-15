import { ParserRegistry } from "../shared/parser.interface";
import { ProxyResolver } from "../shared/proxy.types";
export type VerificationMethod = "LINK" | "SMS" | "TRANSACTION_REF" | "OCR" | "SCREENSHOT";
export type RawProof = string | Buffer;
export interface VerifyPayload {
    /** parserKey — e.g. 'CBE', 'TELEBIRR', 'ABYSSINIA', 'EBIRR' */
    bank: string;
    amount: number;
    verMethod: VerificationMethod;
    rawProof: RawProof;
    accountNumber?: string;
    countryCode?: string;
    amountTolerance?: number;
}
export type VerifyResult = {
    status: "SUCCESS";
    receipt: {
        bank: string;
        receipt: {
            transactionNumber: string;
            date: string;
            amount: string;
            receiverAccount: string;
            receiverName: string;
        };
    };
} | {
    status: "FAIL";
    reason: string;
};
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
export declare class VerificationEngine {
    private readonly parsers;
    private readonly fetcher;
    private readonly ocrReader;
    constructor(options?: {
        proxyResolver?: ProxyResolver | null;
        ocrReader?: (input: RawProof) => Promise<string>;
        /** Override or extend the default parser registry */
        parsers?: ParserRegistry;
    });
    verify(payload: VerifyPayload): Promise<VerifyResult>;
    /** List all registered parser keys */
    getSupportedBanks(): string[];
}
//# sourceMappingURL=verification-engine.d.ts.map