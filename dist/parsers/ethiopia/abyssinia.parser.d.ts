import { ParserAndExtractor, ParserFetchContext, RawReceipt } from "../../shared/parser.interface";
export declare class AbyssiniaParser implements ParserAndExtractor {
    private readonly fallbackFetcher;
    extract(sms: string, accNumber?: string): {
        link: string;
    };
    transactionRef(transactionRef: string, accountNumber?: string): {
        link: string;
    };
    fetch(link: string, context?: ParserFetchContext): Promise<{
        page: any;
    }>;
    receiptParser(html: string): Promise<{
        bank: string;
        receipt: RawReceipt;
    }>;
    private buildLink;
}
//# sourceMappingURL=abyssinia.parser.d.ts.map