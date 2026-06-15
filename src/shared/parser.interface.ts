import type { BankFetchService } from "../core/bank-fetch.service";

/**
 * Raw receipt fields returned by every bank parser.
 * All values are strings at extraction time.
 */
export interface RawReceipt {
  transactionNumber: string;
  date: string;
  amount: string;
  receiverAccount: string;
  receiverName: string;
}

export interface ParserFetchContext {
  fetcher: BankFetchService;
  countryCode: string;
}

/**
 * Contract that every bank parser must implement.
 *
 * Three-step flow:
 *   1. extract(text)  → derives the receipt URL from raw SMS/OCR text
 *   2. fetch(link)    → downloads the receipt page from the bank
 *   3. receiptParser  → parses the page into a structured RawReceipt
 */
export interface ParserAndExtractor {
  extract(text: string, accountNumber?: string): { link: string };
  transactionRef?(
    transactionRef: string,
    accountNumber?: string,
  ): { link: string };
  fetch(link: string, context?: ParserFetchContext): Promise<{ page: any }>;
  receiptParser(input: any): Promise<{ bank: string; receipt: RawReceipt }>;
}

export type ParserRegistry = Record<string, ParserAndExtractor>;
