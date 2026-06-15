import * as cheerio from "cheerio";
import { Element } from "domhandler";
import { BankFetchService } from "../../core/bank-fetch.service";
import {
  ParserAndExtractor,
  ParserFetchContext,
  RawReceipt,
} from "../../shared/parser.interface";

export class TelebirrParser implements ParserAndExtractor {
  private readonly fallbackFetcher = new BankFetchService();

  extract(text: string, _accountNumber?: string): { link: string } {
    if (!text) return { link: "" };
    const cleaned = this.cleanText(text);

    const txnNumberMatch = cleaned.match(
      /your transaction number is\s+([A-Z0-9]{8,12})/i,
    );
    if (txnNumberMatch) {
      const trx = txnNumberMatch[1].replace(/[^A-Z0-9]/gi, "").toUpperCase();
      return { link: `https://transactioninfo.ethiotelecom.et/receipt/${trx}` };
    }

    const appShareMatch = cleaned.match(
      /Transaction\s+Number\s*[:\-]?\s*([A-Z0-9]{8,12})(?:\s|$|[^A-Z0-9])/i,
    );
    if (appShareMatch) {
      const trx = appShareMatch[1].replace(/[^A-Z0-9]/gi, "").toUpperCase();
      return { link: `https://transactioninfo.ethiotelecom.et/receipt/${trx}` };
    }

    const rawMatch = text.match(
      /your transaction number is\s+([A-Z0-9]{8,12})/i,
    );
    if (rawMatch) {
      const trx = rawMatch[1].replace(/[^A-Z0-9]/gi, "").toUpperCase();
      return { link: `https://transactioninfo.ethiotelecom.et/receipt/${trx}` };
    }

    return { link: "" };
  }

  transactionRef(transactionRef: string): { link: string } {
    const trx = transactionRef.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    return { link: `https://transactioninfo.ethiotelecom.et/receipt/${trx}` };
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
        waitUntil: "domcontentloaded",
        waitForSelector: "table",
        timeoutMs: 60000,
      },
    );
    return { page: response.data };
  }

  async receiptParser(
    html: string,
  ): Promise<{ bank: string; receipt: RawReceipt }> {
    const $ = cheerio.load(html);

    let transactionRow: cheerio.Cheerio<Element> | undefined;

    $("tr").each((_, tr) => {
      const tds = $(tr).find("td");
      if (tds.length === 3) {
        const tx = tds.eq(0).text().trim();
        if (/^[A-Z0-9]{8,12}$/.test(tx)) {
          transactionRow = tds;
        }
      }
    });

    if (!transactionRow) {
      throw new Error("Invalid Telebirr receipt: transaction row not found");
    }

    const extractByLabel = (label: string): string =>
      $("td")
        .filter((_, el) => $(el).text().includes(label))
        .next("td")
        .text()
        .trim();

    return {
      bank: "TELEBIRR",
      receipt: {
        transactionNumber: transactionRow.eq(0).text().trim(),
        date: transactionRow.eq(1).text().trim(),
        amount: transactionRow
          .eq(2)
          .text()
          .trim()
          .replace(/[^\d.]/g, ""),
        receiverName: extractByLabel("Credited Party name"),
        receiverAccount: extractByLabel("Credited party account no"),
      },
    };
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, " ")
      .replace(/https:\s*\/\//gi, "https://")
      .replace(/\s*\/\s*/g, "/")
      .trim();
  }
}
