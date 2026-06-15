import { JSDOM } from "jsdom";
import { BankFetchService } from "../../core/bank-fetch.service";
import {
  ParserAndExtractor,
  ParserFetchContext,
  RawReceipt,
} from "../../shared/parser.interface";

export class AbyssiniaParser implements ParserAndExtractor {
  private readonly fallbackFetcher = new BankFetchService();

  extract(sms: string, accNumber?: string): { link: string } {
    const cleaned = sms.replace(/hitps/gi, "https").replace(/\s+/g, " ").trim();

    const urlMatch = cleaned.match(/trx\s*=\s*([A-Z0-9]{8,})/i);
    if (urlMatch) return { link: this.buildLink(urlMatch[1], accNumber) };

    const ocrMatch = cleaned.match(
      /Transaction\s+(?:Reference\s+)?([A-Z]{2}\d{5}[A-Z0-9]+)/i,
    );
    if (ocrMatch) return { link: this.buildLink(ocrMatch[1], accNumber) };

    const refMatch = cleaned.match(/\b(FT\d{5}[A-Z0-9]{4,})\b/i);
    if (refMatch) return { link: this.buildLink(refMatch[1], accNumber) };

    return { link: "" };
  }

  transactionRef(transactionRef: string, accountNumber?: string): { link: string } {
    return { link: this.buildLink(transactionRef, accountNumber) };
  }

  async fetch(
    link: string,
    context?: ParserFetchContext,
  ): Promise<{ page: any }> {
    if (!link) throw new Error("No link provided");
    const fetcher = context?.fetcher ?? this.fallbackFetcher;
    const response = await fetcher.fetchBrowserPage(
      link,
      context?.countryCode ?? "ET",
      {
        waitUntil: "networkidle2",
        waitForSelector: "table",
        timeoutMs: 60000,
      },
    );
    return { page: response.data };
  }

  async receiptParser(
    html: string,
  ): Promise<{ bank: string; receipt: RawReceipt }> {
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const rows = Array.from(
      document.querySelectorAll("table tr"),
    ) as HTMLTableRowElement[];
    const result: Record<string, string> = {};

    rows.forEach((row) => {
      const cells = Array.from(
        row.querySelectorAll("td"),
      ) as HTMLTableCellElement[];
      if (cells.length < 2) return;

      const label = cells[0].textContent?.trim().toLowerCase() ?? "";
      const value = cells[1].textContent?.trim() ?? "";

      if (label.includes("receiver's account")) result.receiverAccount = value;
      if (label.includes("receiver's name")) result.receiverName = value;
      if (label.includes("transferred amount")) result.amount = value;
      if (label.includes("transaction date")) result.date = value;
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

  private buildLink(trx: string, accountNumber?: string): string {
    const upper = trx.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    if (upper.length === 12 && accountNumber && accountNumber.length >= 5) {
      return `https://cs.bankofabyssinia.com/slip/?trx=${upper}${accountNumber.slice(-5)}`;
    }
    return `https://cs.bankofabyssinia.com/slip/?trx=${upper}`;
  }
}
