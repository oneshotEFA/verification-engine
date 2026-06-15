import { ParserAndExtractor, ParserFetchContext, RawReceipt } from "../../shared/parser.interface";
export declare class TelebirrParser implements ParserAndExtractor {
    private readonly fallbackFetcher;
    extract(text: string, _accountNumber?: string): {
        link: string;
    };
    transactionRef(transactionRef: string): {
        link: string;
    };
    fetch(link: string, context?: ParserFetchContext): Promise<{
        page: any;
    }>;
    receiptParser(html: string): Promise<{
        bank: string;
        receipt: RawReceipt;
    }>;
    private cleanText;
}
//# sourceMappingURL=telebirr.parser.d.ts.map