import { ParserAndExtractor, ParserFetchContext, RawReceipt } from "../../shared/parser.interface";
export declare class CbeParser implements ParserAndExtractor {
    private readonly fallbackFetcher;
    extract(text: string, accountNumber?: string): {
        link: string;
    };
    transactionRef(transactionRef: string, accountNumber?: string): {
        link: string;
    };
    fetch(link: string, context?: ParserFetchContext): Promise<{
        page: any;
    }>;
    receiptParser(input: any): Promise<{
        bank: string;
        receipt: RawReceipt;
    }>;
    private fetchJson;
    private fetchPdf;
    private parseJson;
    private parsePdf;
    private isNewFormat;
    private buildOldLink;
    private normalizeDate;
}
//# sourceMappingURL=cbe.parser.d.ts.map