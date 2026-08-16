import pdf from "pdf-parse";
import { JSDOM } from "jsdom";
import { BankFetchService } from "../../core/bank-fetch.service";
import {
  ParserAndExtractor,
  ParserFetchContext,
  RawReceipt,
} from "../../shared/parser.interface";

export class CbeParser implements ParserAndExtractor {
  private readonly fallbackFetcher = new BankFetchService();

  extract(text: string, accountNumber?: string): { link: string } {
    if (!text) throw new Error("SMS text is empty");

    const cleaned = text
      .replace(/https?:\/\/\s+/gi, "https://")
      .replace(/\?\s+/g, "?")
      .replace(/=\s+/g, "=");

    // v2 format: https://mbreciept.cbe.com.et/v2-hfHCxGkik5jOG1UM9oqH
    const v2Format = cleaned.match(
      /https?:\/\/[Mm]breciept\.cbe\.com\.et\/(v2-[A-Za-z0-9_-]+)/i,
    );
    if (v2Format) {
      return {
        link: `https://mbreciept.cbe.com.et/${v2Format[1]}`,
      };
    }

    // New format: https://Mbreciept.cbe.com.et/FT26093JCD32-18872366
    const newFormat = cleaned.match(
      /https?:\/\/[Mm]breciept\.cbe\.com\.et\/([A-Z0-9]+-\d+)/i,
    );
    if (newFormat) {
      return {
        link: `https://mbreciept.cbe.com.et/${newFormat[1].toUpperCase()}`,
      };
    }

    const oldUrlMatch = cleaned.match(
      /https?:\/\/apps\.cbe\.com\.et:\d+\/?\?i{1,2}d=([A-Z0-9]+)/i,
    );
    if (oldUrlMatch)
      return { link: this.buildOldLink(oldUrlMatch[1], accountNumber) };

    const idParamMatch = cleaned.match(/\bi{1,2}[dD]=([A-Z0-9]{10,})/i);
    if (idParamMatch)
      return { link: this.buildOldLink(idParamMatch[1], accountNumber) };

    const ftMatch = cleaned.match(/\b(FT[A-Z0-9]{8,})\b/i);
    if (ftMatch) return { link: this.buildOldLink(ftMatch[1], accountNumber) };

    throw new Error("No valid CBE transaction link found in SMS");
  }

  transactionRef(
    transactionRef: string,
    accountNumber?: string,
  ): { link: string } {
    return { link: this.buildOldLink(transactionRef, accountNumber) };
  }

  async fetch(
    link: string,
    context?: ParserFetchContext,
  ): Promise<{ page: any }> {
    if (this.isV2Format(link)) {
      return this.fetchV2Json(link, context);
    }
    return this.isNewFormat(link)
      ? this.fetchJson(link, context)
      : this.fetchPdf(link, context);
  }

  async receiptParser(
    input: any,
  ): Promise<{ bank: string; receipt: RawReceipt }> {
    if (!input) throw new Error("No receipt data to parse");

    const buf: Buffer = Buffer.isBuffer(input)
      ? input
      : Buffer.from(input as string, "utf-8");

    const prefix = buf.slice(0, 5).toString("utf-8");

    if (prefix === "JSON:") {
      return this.parseJson(buf.slice(5));
    }

    if (prefix === "HTML:") {
      return this.parseV2Html(buf.slice(5).toString("utf-8"));
    }

    const pdfBuf = prefix === "PDF:" ? buf.slice(4) : buf;
    return this.parsePdf(pdfBuf);
  }

  // ------------------------------------------------------------------
  // V2 format: mbreciept.cbe.com.et/v2-{TOKEN}
  // Uses the same API but with v2- prefix on the token.
  // Falls back to parsing the SSR HTML if the API fails.
  // ------------------------------------------------------------------

  private async fetchV2Json(
    link: string,
    context?: ParserFetchContext,
  ): Promise<{ page: Buffer }> {
    const match = link.match(/mbreciept\.cbe\.com\.et\/(v2-[A-Za-z0-9_-]+)/i);
    if (!match) throw new Error("Invalid v2 CBE link");
    const token = match[1]; // e.g. "v2-hfHCxGkik5jOG1UM9oqH"
    const url = `https://mb.cbe.com.et/api/v1/transactions/public/transaction-detail/${token}`;

    const fetcher = context?.fetcher ?? this.fallbackFetcher;
    let response;
    try {
      response = await fetcher.fetch(url, context?.countryCode ?? "ET", {
        timeoutMs: 25000,
        validateStatus: () => true,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json, text/plain, */*",
          Origin: "https://mbreciept.cbe.com.et",
          Referer: "https://mbreciept.cbe.com.et/",
          "x-app-id": "d1292e42-7400-49de-a2d3-9731caa4c819",
          "x-app-version": "0a01980b-9859-1369-8198-59f403820000",
        },
      });
    } catch {
      // Network error — fall back to SSR HTML parsing
      return this.fetchV2Html(link, context);
    }

    // If API returns 200 with valid JSON, use it
    if (
      response.status === 200 &&
      response.data &&
      (typeof response.data === "string" ? response.data.startsWith("{") : true)
    ) {
      const json =
        typeof response.data === "string"
          ? response.data
          : JSON.stringify(response.data);

      return {
        page: Buffer.concat([
          Buffer.from("JSON:", "utf-8"),
          Buffer.from(json, "utf-8"),
        ]),
      };
    }

    // API failed (401, 500, etc.) — fall back to parsing the SSR HTML page
    return this.fetchV2Html(link, context);
  }

  /**
   * Fetch the v2 receipt as SSR HTML and prefix with HTML: marker.
   * Used as a fallback when the JSON API is unavailable.
   */
  private async fetchV2Html(
    link: string,
    context?: ParserFetchContext,
  ): Promise<{ page: Buffer }> {
    const fetcher = context?.fetcher ?? this.fallbackFetcher;
    const response = await fetcher.fetch(link, context?.countryCode ?? "ET", {
      timeoutMs: 25000,
      validateStatus: () => true,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml,*/*",
      },
    });

    if (response.status !== 200 || !response.data) {
      throw new Error(
        `CBE v2 receipt fetch failed (status ${response.status})`,
      );
    }

    const html =
      typeof response.data === "string"
        ? response.data
        : Buffer.from(response.data).toString("utf-8");

    if (!html.includes("Transferred Amount")) {
      throw new Error(
        "CBE v2 receipt page does not contain expected receipt data",
      );
    }

    return {
      page: Buffer.concat([
        Buffer.from("HTML:", "utf-8"),
        Buffer.from(html, "utf-8"),
      ]),
    };
  }

  /**
   * Parse the v2 Nuxt SSR HTML receipt.
   * Fields are in grid divs: <span class="...">Label:</span><span class="...">Value</span>
   */
  private parseV2Html(html: string): { bank: string; receipt: RawReceipt } {
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const fields = new Map<string, string>();
    // Match all grid row divs containing label + value spans
    const rows = document.querySelectorAll("div.grid.grid-cols-2");
    for (const row of rows) {
      const spans = row.querySelectorAll("span");
      if (spans.length >= 2) {
        const label = (spans[0] as HTMLElement).textContent?.trim() ?? "";
        const value = (spans[1] as HTMLElement).textContent?.trim() ?? "";
        if (label.endsWith(":")) {
          fields.set(label.replace(/:$/, "").trim(), value);
        }
      }
    }

    // Extract the receiver name and account from the sequence of fields.
    // The HTML has two "Account" fields (Payer's then Receiver's),
    // so we need to track order.
    let receiverName = "";
    let receiverAccount = "";
    let lastLabel = "";

    for (const [label, value] of fields.entries()) {
      if (label === "Receiver") {
        receiverName = value;
      }
      if (label === "Account" && lastLabel === "Receiver") {
        receiverAccount = value;
      }
      lastLabel = label;
    }

    const amount = (fields.get("Transferred Amount") ?? "")
      .replace(/ETB/gi, "")
      .replace(/,/g, "")
      .trim();

    if (!amount) {
      throw new Error("Could not extract amount from CBE v2 receipt");
    }

    return {
      bank: "CBE",
      receipt: {
        transactionNumber: (
          fields.get("Reference No. (VAT Invoice No)") ?? ""
        ).trim(),
        date: (fields.get("Payment Date & Time") ?? "").trim(),
        amount,
        receiverAccount,
        receiverName,
      },
    };
  }

  // ------------------------------------------------------------------
  // Legacy new format: mbreciept.cbe.com.et/{FT_REF}-{ACCOUNT_SUFFIX}
  // ------------------------------------------------------------------

  private async fetchJson(
    link: string,
    context?: ParserFetchContext,
  ): Promise<{ page: Buffer }> {
    const match = link.match(/Mbreciept\.cbe\.com\.et\/([A-Z0-9][A-Z0-9-]+)/i);
    if (!match) throw new Error("Invalid new-format CBE link");
    const txnId = match[1];
    const url = `https://mb.cbe.com.et/api/v1/transactions/public/transaction-detail/${txnId}`;
    const fetcher = context?.fetcher ?? this.fallbackFetcher;

    const response = await fetcher.fetch(url, context?.countryCode ?? "ET", {
      timeoutMs: 25000,
      validateStatus: () => true,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json, text/plain, */*",
        Origin: "https://mbreciept.cbe.com.et",
        Referer: "https://mbreciept.cbe.com.et/",
        "x-app-id": "d1292e42-7400-49de-a2d3-9731caa4c819",
        "x-app-version": "0a01980b-9859-1369-8198-59f403820000",
      },
    });

    if (response.status !== 200 || !response.data) {
      throw new Error(
        `CBE API returned status ${response.status} for ${txnId}`,
      );
    }

    const json =
      typeof response.data === "string"
        ? response.data
        : JSON.stringify(response.data);

    return {
      page: Buffer.concat([
        Buffer.from("JSON:", "utf-8"),
        Buffer.from(json, "utf-8"),
      ]),
    };
  }

  // ------------------------------------------------------------------
  // Old format: apps.cbe.com.et:100/?id=...
  // ------------------------------------------------------------------

  private async fetchPdf(
    link: string,
    context?: ParserFetchContext,
  ): Promise<{ page: Buffer }> {
    const fetcher = context?.fetcher ?? this.fallbackFetcher;
    const response = await fetcher.fetch(link, context?.countryCode ?? "ET", {
      responseType: "arraybuffer",
      timeoutMs: 25000,
      validateStatus: () => true,
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/pdf" },
    });

    const buffer = Buffer.from(response.data);

    if (response.status === 404) {
      const txnIdMatch = link.match(/id=([A-Z0-9]+)/i);
      if (txnIdMatch) {
        const txnId = txnIdMatch[1].slice(0, 12);
        const accountSuffix = txnIdMatch[1].slice(12);
        return this.fetchJson(
          `https://mbreciept.cbe.com.et/${txnId}-${accountSuffix}`,
          context,
        );
      }
      throw new Error("CBE PDF not found and no fallback possible");
    }

    if (response.status !== 200)
      throw new Error(`Unexpected HTTP status: ${response.status}`);

    const preview = buffer.toString("utf-8", 0, 300).toLowerCase();
    if (preview.includes("<html") || preview.includes("access denied")) {
      throw new Error("Server returned HTML instead of PDF");
    }

    if (!buffer.subarray(0, 4).toString().startsWith("%PDF")) {
      throw new Error("Response is not a valid PDF");
    }

    return {
      page: Buffer.concat([Buffer.from("PDF:", "utf-8"), buffer]),
    };
  }

  // ------------------------------------------------------------------
  // Parsers
  // ------------------------------------------------------------------

  private parseJson(input: Buffer): { bank: string; receipt: RawReceipt } {
    let data: Record<string, any>;
    try {
      data = JSON.parse(input.toString("utf-8"));
    } catch {
      throw new Error("Failed to parse CBE JSON receipt");
    }

    return {
      bank: "CBE",
      receipt: {
        transactionNumber: (data.id ?? "").toString().toUpperCase().trim(),
        date: this.normalizeDate(
          data.dateTimes?.[0] ?? data.processingDate ?? "",
        ),
        receiverAccount: (data.creditAccountNo ?? "").trim(),
        receiverName: (data.creditAccountHolder ?? "").trim(),
        amount: (data.amountDebited ?? data.debitAmount ?? "")
          .toString()
          .replace(/,/g, "")
          .trim(),
      },
    };
  }

  private async parsePdf(
    input: Buffer,
  ): Promise<{ bank: string; receipt: RawReceipt }> {
    let text: string;
    try {
      const parsed = await pdf(input);
      text = parsed.text ?? "";
    } catch (err) {
      throw new Error("Failed to parse PDF: " + (err as Error).message);
    }

    if (!text.trim()) throw new Error("PDF parsed but no text extracted");

    const s = text.replace(/\s+/g, " ").trim();

    return {
      bank: "CBE",
      receipt: {
        transactionNumber: (
          s.match(
            /Reference\s*No[.\s]*(?:\(VAT\s*Invoice\s*No\))?\s*([A-Z0-9]{8,})/i,
          )?.[1] ??
          s.match(/\b(FT[A-Z0-9]{8,})\b/)?.[1] ??
          ""
        )
          .trim()
          .toUpperCase(),

        date:
          s
            .match(/Payment\s*Date\s*&\s*Time\s*([\d\/:, ]+(?:AM|PM))/i)?.[1]
            ?.trim() ?? "",

        receiverAccount:
          s.match(/Receiver[A-Z\s]+Account([\d*]+)/i)?.[1]?.trim() ?? "",

        receiverName:
          s.match(/Receiver([A-Z][A-Z\s]+?)(?=Account)/i)?.[1]?.trim() ?? "",

        amount:
          s
            .match(/Transferred\s*Amount\s*([\d,]+(?:\.\d{2})?)\s*ETB/i)?.[1]
            ?.replace(/,/g, "")
            .trim() ?? "",
      },
    };
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  private isV2Format(link: string): boolean {
    return /mbreciept\.cbe\.com\.et\/v2-/i.test(link);
  }

  private isNewFormat(link: string): boolean {
    return /mbreciept\.cbe\.com\.et/i.test(link);
  }

  private buildOldLink(trxId: string, accountNumber?: string): string {
    const upper = trxId.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    if (upper.length <= 19 && accountNumber && accountNumber.length >= 8) {
      return `https://apps.cbe.com.et:100/?id=${upper.slice(0, 12)}${accountNumber.slice(-8)}`;
    }
    return `https://apps.cbe.com.et:100/?id=${upper}`;
  }

  private normalizeDate(raw: string): string {
    if (!raw) return "";
    if (raw.includes("T")) {
      const d = new Date(raw);
      if (!isNaN(d.getTime()))
        return d.toLocaleString("en-US", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        });
    }
    if (/^\d{8}$/.test(raw)) {
      return `${raw.slice(4, 6)}/${raw.slice(6, 8)}/${raw.slice(0, 4)}`;
    }
    return raw;
  }
}
