import { JSDOM } from "jsdom";
import { BankFetchService } from "../../core/bank-fetch.service";
import {
  ParserAndExtractor,
  ParserFetchContext,
  RawReceipt,
} from "../../shared/parser.interface";

/**
 * Awash Bank (Ethiopia) receipt parser.
 *
 * Receipts are publicly accessible HTML pages at:
 *   https://awashpay.awashbank.com:8225/-{BASE36_TXN_ID}-{COUNTER}
 *
 * The page contains three <table class="info-table"> sections:
 *   1. Company information (static bank details)
 *   2. Customer information (sender details)
 *   3. Transaction information (payment details)
 *
 * Each table row uses 3 <td> cells: label, ":", value.
 * Labels are wrapped in <tt><span>...</span></tt>.
 *
 * No puppeteer required — plain HTTP fetch.
 */
export class AwashParser implements ParserAndExtractor {
  private readonly fallbackFetcher = new BankFetchService();

  // ------------------------------------------------------------------
  // 1. Extract receipt link from SMS or free-text
  // ------------------------------------------------------------------
  extract(text: string, _accountNumber?: string): { link: string } {
    const cleaned = this.cleanText(text);

    // Match the full receipt URL — capture everything after /- (token has two hyphen-separated parts)
    const urlMatch = cleaned.match(
      /https?:\/\/awashpay\.awashbank\.com:\d+\/-([A-Za-z0-9-]+)/i,
    );
    if (urlMatch) {
      return {
        link: `https://awashpay.awashbank.com:8225/-${urlMatch[1]}`,
      };
    }

    // Fallback: look for the token pattern (e.g. "2KDL95Z0NR-4U61O6" or "E4092F0CEBDB-205TGG")
    const tokenMatch = cleaned.match(/\b([A-Z0-9]{6,14}-[A-Z0-9]{5,6})\b/i);
    if (tokenMatch) {
      return {
        link: `https://awashpay.awashbank.com:8225/-${tokenMatch[1].toUpperCase()}`,
      };
    }

    return { link: "" };
  }

  // ------------------------------------------------------------------
  // 2. Build receipt link from a transaction reference
  // ------------------------------------------------------------------
  transactionRef(transactionRef: string): { link: string } {
    const ref = transactionRef.replace(/[^A-Za-z0-9\-]/g, "").toUpperCase();
    return {
      link: `https://awashpay.awashbank.com:8225/-${ref}`,
    };
  }

  // ------------------------------------------------------------------
  // 3. Fetch the receipt HTML page
  // ------------------------------------------------------------------
  async fetch(
    link: string,
    context?: ParserFetchContext,
  ): Promise<{ page: any }> {
    if (!link) throw new Error("No Awash receipt link provided");

    const fetcher = context?.fetcher ?? this.fallbackFetcher;
    const response = await fetcher.fetch(link, context?.countryCode ?? "ET", {
      timeoutMs: 30000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (typeof response.data !== "string") {
      throw new Error("Unexpected response type from Awash receipt page");
    }

    // Awash returns 403 for invalid tokens (nginx)
    if (response.status === 403) {
      throw new Error(
        "Awash receipt not found or link has expired (403 Forbidden)",
      );
    }

    return { page: response.data };
  }

  // ------------------------------------------------------------------
  // 4. Parse the HTML receipt into a structured RawReceipt
  // ------------------------------------------------------------------
  async receiptParser(
    html: string,
  ): Promise<{ bank: string; receipt: RawReceipt }> {
    if (!html || typeof html !== "string") {
      throw new Error("No HTML data to parse for Awash receipt");
    }

    const dom = new JSDOM(html);
    const document = dom.window.document;

    // The receipt has three tables with class "info-table".
    // The third one contains transaction details.
    const tables = document.querySelectorAll("table.info-table");
    if (tables.length < 3) {
      throw new Error(
        `Expected at least 3 info-table sections, found ${tables.length}`,
      );
    }

    // Parse all rows from the transaction table (3rd table)
    const transactionTable = tables[2] as HTMLElement;
    const fieldMap = this.parseTableRows(transactionTable);

    // Parse customer table (2nd table) for sender info
    const customerTable = tables[1] as HTMLElement;
    const customerFields = this.parseTableRows(customerTable);

    const amount = this.cleanAmount(fieldMap.get("Amount") ?? "");
    const transactionId = (fieldMap.get("Transaction ID") ?? "").trim();
    const date = (fieldMap.get("Transaction Time") ?? "").trim();

    // Beneficiary = receiver
    const receiverName = (fieldMap.get("Beneficiary name") ?? "").trim();
    const receiverAccount = (fieldMap.get("Beneficiary Account") ?? "").trim();

    if (!amount) {
      throw new Error("Could not extract amount from Awash receipt");
    }

    return {
      bank: "AWASH",
      receipt: {
        transactionNumber: transactionId,
        date,
        amount,
        receiverAccount,
        receiverName,
      },
    };
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  /**
   * Parse all rows from an Awash info-table.
   * Each row has 3 <td> cells: label, ":", value.
   */
  private parseTableRows(table: HTMLElement): Map<string, string> {
    const fields = new Map<string, string>();
    const rows = table.querySelectorAll("tr");

    for (const row of rows) {
      const cells = row.querySelectorAll("td");
      if (cells.length >= 3) {
        // cells[0] = label (may contain <tt><span>label</span></tt>)
        // cells[1] = ":"
        // cells[2] = value
        const label = (cells[0] as HTMLElement).textContent?.trim() ?? "";
        const value = (cells[2] as HTMLElement).textContent?.trim() ?? "";
        if (label) {
          fields.set(label, value);
        }
      }
    }

    return fields;
  }

  /**
   * Strip currency suffix and commas from amount string.
   * e.g. "500 ETB" → "500", "1,350 ETB" → "1350"
   */
  private cleanAmount(raw: string): string {
    return raw.replace(/ETB/gi, "").replace(/,/g, "").trim();
  }

  /**
   * Normalize whitespace in input text for regex matching.
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, " ")
      .replace(/https:\s*\/\//gi, "https://")
      .replace(/\s*\/\s*/g, "/")
      .trim();
  }
}
