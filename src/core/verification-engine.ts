import { PARSER_REGISTRY } from "../parsers";
import { ParserRegistry } from "../shared/parser.interface";
import { ProxyResolver } from "../shared/proxy.types";
import { UrlValidationConfig } from "../validation/types";
import { URL_VALIDATION_REGISTRY } from "../validation/registry";
import { validateReceiptUrl } from "../validation/validate-receipt-url";
import { BankFetchService } from "./bank-fetch.service";

export type VerificationMethod =
  | "LINK"
  | "SMS"
  | "TRANSACTION_REF"
  | "OCR"
  | "SCREENSHOT";

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

export type VerifyResult =
  | {
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
    }
  | { status: "FAIL"; reason: string };

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
 *   // With custom URL validators (extend or override)
 *   const engine = new VerificationEngine({ urlValidators: { ...URL_VALIDATION_REGISTRY, MY_BANK: MY_CONFIG } });
 *
 *   const result = await engine.verify({
 *     bank: 'CBE',
 *     amount: 500,
 *     verMethod: 'LINK',
 *     rawProof: 'https://apps.cbe.com.et:100/?id=FT26093JCD3218872366',
 *   });
 */
export class VerificationEngine {
  private readonly parsers: ParserRegistry;
  private readonly fetcher: BankFetchService;
  private readonly ocrReader: (input: RawProof) => Promise<string>;
  private readonly urlValidators: Record<string, UrlValidationConfig>;

  constructor(options?: {
    proxyResolver?: ProxyResolver | null;
    ocrReader?: (input: RawProof) => Promise<string>;
    /** Override or extend the default parser registry */
    parsers?: ParserRegistry;
    /** Override or extend the default URL validator registry */
    urlValidators?: Record<string, UrlValidationConfig>;
  }) {
    this.fetcher = new BankFetchService(options?.proxyResolver ?? null);
    this.parsers = options?.parsers ?? PARSER_REGISTRY;
    this.ocrReader = options?.ocrReader ?? readTextWithTesseract;
    this.urlValidators = options?.urlValidators ?? URL_VALIDATION_REGISTRY;
  }

  async verify(payload: VerifyPayload): Promise<VerifyResult> {
    const parser = this.parsers[payload.bank];
    const countryCode = payload.countryCode ?? "ET";

    if (!parser) {
      return {
        status: "FAIL",
        reason: `No parser registered for bank: ${payload.bank}`,
      };
    }

    try {
      let link: string;

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
              reason:
                "TRANSACTION_REF verification requires rawProof to be a transaction reference string",
            };
          }
          link = (
            parser.transactionRef?.(payload.rawProof, payload.accountNumber) ??
            parser.extract(payload.rawProof, payload.accountNumber)
          ).link;
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

      const config = this.urlValidators[payload.bank];

      if (!config) {
        return {
          status: "FAIL",
          reason: `No URL validator registered for bank: ${payload.bank}`,
        };
      }

      link = validateReceiptUrl(link, config);

      const fetched = await parser.fetch(link, {
        fetcher: this.fetcher,
        countryCode,
      });
      const receipt = await parser.receiptParser(fetched.page);

      if (!receipt?.receipt) {
        return { status: "FAIL", reason: "Parser returned no receipt data" };
      }

      if (
        !amountsMatch(
          payload.amount,
          receipt.receipt.amount,
          payload.amountTolerance,
        )
      ) {
        return {
          status: "FAIL",
          reason: `Receipt amount ${receipt.receipt.amount || "(empty)"} does not match expected amount ${payload.amount}`,
        };
      }

      return { status: "SUCCESS", receipt };
    } catch (err) {
      return {
        status: "FAIL",
        reason:
          err instanceof Error
            ? err.message
            : "Unexpected error during verification",
      };
    }
  }

  /** List all registered parser keys */
  getSupportedBanks(): string[] {
    return Object.keys(this.parsers);
  }
}

const readTextWithTesseract = async (input: RawProof): Promise<string> => {
  const { recognize } = await import("tesseract.js");
  const result = await recognize(input, "eng");
  return result.data.text ?? "";
};

const parseAmount = (value: string | number): number | null => {
  const normalized = value
    .toString()
    .replace(/[^\d.-]/g, "")
    .trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const amountsMatch = (
  expected: number,
  actual: string,
  tolerance = 0.01,
): boolean => {
  const parsedActual = parseAmount(actual);
  if (parsedActual === null) return false;
  return Math.abs(parsedActual - expected) <= tolerance;
};
