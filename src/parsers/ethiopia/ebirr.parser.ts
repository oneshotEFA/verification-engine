import { JSDOM } from "jsdom";
import { BankFetchService } from "../../core/bank-fetch.service";
import {
  ParserAndExtractor,
  ParserFetchContext,
  RawReceipt,
} from "../../shared/parser.interface";

export class EBirrParser implements ParserAndExtractor {
  private readonly fallbackFetcher = new BankFetchService();

  extract(sms: string, _accountNumber?: string): { link: string } {
    const text = this.cleanText(sms);

    const match = text.match(
      /https:\/\/transactioninfo\.ebirr\.com\/[\w-]+\/receipt\/([A-Z0-9]{8,})/i,
    );
    if (!match) return { link: "" };

    return {
      link: `https://transactioninfo.ebirr.com/kaafimf-Ebirr/receipt/${match[1]}`,
    };
  }

  transactionRef(transactionRef: string): { link: string } {
    const trx = transactionRef.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    return {
      link: `https://transactioninfo.ebirr.com/kaafimf-Ebirr/receipt/${trx}`,
    };
  }

  async fetch(
    link: string,
    context?: ParserFetchContext,
  ): Promise<{ page: any }> {
    if (!link) throw new Error("No link provided");
    const fetcher = context?.fetcher ?? this.fallbackFetcher;
    const response = await fetcher.fetch(link, context?.countryCode ?? "ET", {
      timeoutMs: 30000,
    });
    return { page: response.data };
  }

  async receiptParser(
    html: string,
  ): Promise<{ bank: string; receipt: RawReceipt }> {
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const getValueByLabel = (label: string): string => {
      const cells = Array.from(
        document.querySelectorAll("td.invoice"),
      ) as HTMLElement[];

      const labelCell = cells.find((td) =>
        td.textContent?.trim().toUpperCase().includes(label),
      );
      if (!labelCell) return "";

      const valueCell = labelCell.nextElementSibling as HTMLElement | null;
      return (valueCell?.textContent?.trim() ?? "").replace(/ETB/gi, "").trim();
    };

    const headings = Array.from(
      document.querySelectorAll("div.heading"),
    ) as HTMLElement[];

    const receiverDiv = headings.find((div) =>
      div.textContent?.includes("Receiver Info"),
    );

    let receiverName = "";
    let receiverAccount = "";

    if (receiverDiv) {
      const table = receiverDiv.nextElementSibling as HTMLElement | null;
      const rows = Array.from(
        table?.querySelectorAll("tr") ?? [],
      ) as HTMLElement[];
      receiverName = rows[1]?.textContent?.trim() ?? "";
      receiverAccount = rows[3]?.textContent?.trim() ?? "";
    }

    return {
      bank: "EBIRR",
      receipt: {
        date: getValueByLabel("DATE"),
        transactionNumber: getValueByLabel("RECEIPT NO"),
        amount: getValueByLabel("AMOUNT"),
        receiverName,
        receiverAccount,
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
