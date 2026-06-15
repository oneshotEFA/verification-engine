/**
 * Safely parse a raw date string — returns null instead of throwing.
 * Use when a missing date should be handled gracefully.
 */
export declare const safeParsDate: (raw: string | null | undefined) => Date | null;
/**
 * Parse a raw bank date string into a Date object.
 *
 * Supported formats:
 *   - eBirr:     "2026-02-11 20:07:02 +0300 EAT"
 *   - Telebirr:  "18-03-2026 21:46:09"
 *   - CBE PDF:   "3/11/2026, 6:15:00 PM"
 *   - BOA:       "23/01/26 14:04" or "23/01/2026 14:04"
 */
export declare const parseDate: (raw: string) => Date;
//# sourceMappingURL=date-parser.util.d.ts.map