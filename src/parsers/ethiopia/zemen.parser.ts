import pdf from "pdf-parse";
import { BankFetchService } from "../../core/bank-fetch.service";
import {
  ParserAndExtractor,
  ParserFetchContext,
  RawReceipt,
} from "../../shared/parser.interface";

/**
 * Zemen Bank (Ethiopia) receipt parser.
 *
 * Receipts are publicly accessible PDF files at:
 *   https://share.zemenbank.com/rt/{REFERENCE}/pdf
 *
 * Reference format: alphanumeric, ~10-20 chars
 *   e.g. ZM987654321
 *
 * The PDF contains fields like:
 *   Invoice No, Date, Payer name, Payer account no,
 *   Recipient name, Recipient account no, Reference No,
 *   Transaction status, Transaction Detail, Settled Amount,
 *   Service Charge, VAT, Total Amount Paid
 *
 * Plain HTTP fetch + pdf-parse (no puppeteer needed).
 */
export class ZemenParser implements ParserAndExtractor {
  private readonly fallbackFetcher = new BankFetchService();

  // ------------------------------------------------------------------
  // 1. Extract receipt link from SMS or free-text
  // ------------------------------------------------------------------
  extract(text: string, _accountNumber?: string): { link: string } {
    const cleaned = this.cleanText(text);

    // Match full receipt URL
    const urlMatch = cleaned.match(
      /https?:\/\/share\.zemenbank\.com\/rt\/([A-Za-z0-9]+)\/pdf/i,
    );
    if (urlMatch) {
      return {
        link: `https://share.zemenbank.com/rt/${urlMatch[1]}/pdf`,
      };
    }

    // Fallback: match a Zemen reference pattern in free text
    // References are alphanumeric, typically 10-20 chars
    // e.g. ZM987654321 or a numeric invoice number
    const refMatch = cleaned.match(/\b([A-Z]{2}\d{9,15})\b/i);
    if (refMatch) {
      return {
        link: `https://share.zemenbank.com/rt/${refMatch[1].toUpperCase()}/pdf`,
      };
    }

    return { link: "" };
  }

  // ------------------------------------------------------------------
  // 2. Build receipt link from a transaction reference
  // ------------------------------------------------------------------
  transactionRef(transactionRef: string): { link: string } {
    // If it's already a full receipt URL, pass it through directly
    if (/^https?:\/\//i.test(transactionRef)) {
      return { link: transactionRef.trim() };
    }
    const ref = transactionRef.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    return {
      link: `https://share.zemenbank.com/rt/${ref}/pdf`,
    };
  }

  // ------------------------------------------------------------------
  // 3. Fetch the receipt PDF
  // ------------------------------------------------------------------
  async fetch(
    link: string,
    context?: ParserFetchContext,
  ): Promise<{ page: any }> {
    if (!link) throw new Error("No Zemen receipt link provided");

    const fetcher = context?.fetcher ?? this.fallbackFetcher;
    const response = await fetcher.fetch(link, context?.countryCode ?? "ET", {
      responseType: "arraybuffer",
      timeoutMs: 30000,
      validateStatus: () => true,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
        Accept: "application/pdf,*/*",
      },
    });

    if (response.status === 404) {
      throw new Error("Zemen receipt not found or link has expired (404).");
    }

    if (response.status !== 200) {
      throw new Error(
        `Zemen receipt fetch failed with status ${response.status}`,
      );
    }

    const buffer = Buffer.from(response.data);

    // Validate it's actually a PDF
    const preview = buffer.toString("utf-8", 0, 300).toLowerCase();
    if (preview.includes("<html") || preview.includes("access denied")) {
      throw new Error("Server returned HTML instead of PDF");
    }
    if (!buffer.subarray(0, 4).toString().startsWith("%PDF")) {
      throw new Error("Response is not a valid PDF");
    }

    return { page: buffer };
  }

  // ------------------------------------------------------------------
  // 4. Parse the PDF receipt into a structured RawReceipt
  // ------------------------------------------------------------------
  async receiptParser(
    input: any,
  ): Promise<{ bank: string; receipt: RawReceipt }> {
    if (!input) throw new Error("No receipt data to parse");

    const buf: Buffer = Buffer.isBuffer(input)
      ? input
      : Buffer.from(input as string, "utf-8");

    let text: string;
    try {
      const parsed = await pdf(buf);
      text = parsed.text ?? "";
    } catch (err) {
      throw new Error("Failed to parse Zemen PDF: " + (err as Error).message);
    }

    if (!text.trim()) throw new Error("Zemen PDF parsed but no text extracted");

    const s = text.replace(/\s+/g, " ").trim();

    // Extract fields using regex — Zemen PDF format:
    //   Reference No: ABC123
    //   Date: 29-Jun-2025
    //   Payer name: John Doe
    //   Payer account no.: 1234******567
    //   Recipient name: Jane Smith
    //   Recipient account no.: 9876543210
    //   Total Amount Paid ETB 1,600.00
    //   Transaction status: SUCCESS (or similar)

    const transactionNumber =
      s
        .match(/Reference No:\s*([A-Z0-9]+)/i)?.[1]
        ?.trim()
        .toUpperCase() ??
      s.match(/Invoice No\.?\s*(\d+)/i)?.[1]?.trim() ??
      "";

    // Date formats: "29-Jun-2025" or "29-Jun-2025, 10:55:59 am"
    const date =
      s
        .match(
          /Date[:\s]+([\d]{1,2}-[A-Za-z]{3}-[\d]{4}(?:,[\s\d:]+[ap]m)?)/i,
        )?.[1]
        ?.trim() ?? "";

    // Amount — prefer "Total Amount Paid ETB X,XXX.XX" over "Settled Amount"
    const amount =
      s
        .match(/Total Amount Paid\s*ETB\s*([\d,]+(?:\.\d{2})?)/i)?.[1]
        ?.replace(/,/g, "")
        .trim() ??
      s
        .match(/[\w\s]+ETB\s*([\d,]+(?:\.\d{2})?)/i)?.[1]
        ?.replace(/,/g, "")
        .trim() ??
      "";

    // Receiver / Recipient fields
    const receiverName =
      s
        .match(
          /Recipient name:\s*([A-Za-z][A-Za-z\.\s]+?)(?=\s+Recipient account|$)/i,
        )?.[1]
        ?.trim() ?? "";

    const receiverAccount =
      s
        .match(/Recipient account no\.?\s*([\d*]+)/i)?.[1]
        ?.replace(/[\*]/g, "")
        .trim() ?? "";

    if (!amount) {
      throw new Error("Could not extract amount from Zemen receipt");
    }

    return {
      bank: "ZEMEN",
      receipt: {
        transactionNumber,
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
