import pdf from "pdf-parse";
import { BankFetchService } from "../../core/bank-fetch.service";
import {
  ParserAndExtractor,
  ParserFetchContext,
  RawReceipt,
} from "../../shared/parser.interface";

/**
 * Dashen Bank (Ethiopia) receipt parser.
 *
 * Receipts are publicly accessible PDF files at:
 *   https://receipt.dashensuperapp.com/receipt/{REFERENCE}
 *
 * Reference format: {3-digit}{4-letter type}{timestamp}{2-letter suffix}
 *   e.g. 641OBTS2518100WH, 045WDTS2514600WM, D31OBTI251720001
 *
 * The PDF is generated server-side via wkhtmltopdf — consistent text layout.
 * No puppeteer required — plain HTTP fetch + pdf-parse.
 */
export class DashenParser implements ParserAndExtractor {
  private readonly fallbackFetcher = new BankFetchService();

  // ------------------------------------------------------------------
  // 1. Extract receipt link from SMS or free-text
  // ------------------------------------------------------------------
  extract(text: string, _accountNumber?: string): { link: string } {
    const cleaned = this.cleanText(text);

    // Match full receipt URL
    const urlMatch = cleaned.match(
      /https?:\/\/receipt\.dashensuperapp\.com\/receipt\/([A-Za-z0-9]+)/i,
    );
    if (urlMatch) {
      return {
        link: `https://receipt.dashensuperapp.com/receipt/${urlMatch[1]}`,
      };
    }

    // Fallback: match Dashen reference pattern directly
    // Format: 3 digits + 4 letters + 7-10 digits/chars + 2 letters
    // e.g. 641OBTS2518100WH, D31OBTI251720001, 387ETAP2522000WK
    const refMatch = cleaned.match(/\b(\d{3}[A-Z]{4}\d{6,10}[A-Z]{2})\b/i);
    if (refMatch) {
      return {
        link: `https://receipt.dashensuperapp.com/receipt/${refMatch[1].toUpperCase()}`,
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
      link: `https://receipt.dashensuperapp.com/receipt/${ref}`,
    };
  }

  // ------------------------------------------------------------------
  // 3. Fetch the receipt PDF
  // ------------------------------------------------------------------
  async fetch(
    link: string,
    context?: ParserFetchContext,
  ): Promise<{ page: any }> {
    if (!link) throw new Error("No Dashen receipt link provided");

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
      throw new Error("Dashen receipt not found or link has expired (404).");
    }

    if (response.status !== 200) {
      throw new Error(
        `Dashen receipt fetch failed with status ${response.status}`,
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
      throw new Error("Failed to parse Dashen PDF: " + (err as Error).message);
    }

    if (!text.trim())
      throw new Error("Dashen PDF parsed but no text extracted");

    const s = text.replace(/\s+/g, " ").trim();

    // Extract fields using regex
    const transactionNumber =
      s
        .match(/Transaction Reference:\s*([A-Z0-9]+)/i)?.[1]
        ?.trim()
        .toUpperCase() ?? "";

    const date =
      s
        .match(
          /Transaction Date:\s*([A-Za-z]+ \d{1,2}, \d{4}, [\d:]+\s*[ap]m)/i,
        )?.[1]
        ?.trim() ?? "";

    // Amount: "ETB 1,600.00" or "Transaction Amount: ETB 1,600.00"
    const amount =
      s
        .match(/Transaction Amount:\s*ETB\s*([\d,]+(?:\.\d{2})?)/i)?.[1]
        ?.replace(/,/g, "")
        .trim() ?? "";

    // Receiver fields
    const receiverName =
      s
        .match(
          /Receiver Name:\s*([A-Z][A-Za-z\s]+?)(?=\s+Receiver Account|$)/i,
        )?.[1]
        ?.trim() ?? "";

    const receiverAccount =
      s.match(/Receiver Account Number:\s*([\d]+)/i)?.[1]?.trim() ?? "";

    if (!amount) {
      throw new Error("Could not extract amount from Dashen receipt");
    }

    return {
      bank: "DASHEN",
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
