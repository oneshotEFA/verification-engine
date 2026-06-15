"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDate = exports.safeParsDate = void 0;
const pad = (n) => n.toString().padStart(2, "0");
/**
 * Safely parse a raw date string — returns null instead of throwing.
 * Use when a missing date should be handled gracefully.
 */
const safeParsDate = (raw) => {
    if (!raw?.trim())
        return null;
    try {
        const d = (0, exports.parseDate)(raw);
        return isNaN(d.getTime()) ? null : d;
    }
    catch {
        return null;
    }
};
exports.safeParsDate = safeParsDate;
/**
 * Parse a raw bank date string into a Date object.
 *
 * Supported formats:
 *   - eBirr:     "2026-02-11 20:07:02 +0300 EAT"
 *   - Telebirr:  "18-03-2026 21:46:09"
 *   - CBE PDF:   "3/11/2026, 6:15:00 PM"
 *   - BOA:       "23/01/26 14:04" or "23/01/2026 14:04"
 */
const parseDate = (raw) => {
    if (!raw?.trim())
        throw new Error("Invalid date input: empty string");
    const cleaned = raw.trim();
    // eBirr: "2026-02-11 20:07:02 +0300 EAT"
    const ebirrMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\s+([+-]\d{4})/);
    if (ebirrMatch) {
        const [, year, month, day, hour, minute, second, rawOffset] = ebirrMatch;
        const offset = rawOffset.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
        return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`);
    }
    // Telebirr: "18-03-2026 21:46:09"
    const telebirrMatch = cleaned.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (telebirrMatch) {
        const [, day, month, year, hour, minute, second] = telebirrMatch;
        return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+03:00`);
    }
    // CBE PDF: "3/11/2026, 6:15:00 PM"
    const cbeMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),\s*(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i);
    if (cbeMatch) {
        const [, month, day, year, rawHour, minute, second, meridiem] = cbeMatch;
        let h = parseInt(rawHour, 10);
        if (meridiem.toUpperCase() === "PM" && h !== 12)
            h += 12;
        if (meridiem.toUpperCase() === "AM" && h === 12)
            h = 0;
        return new Date(`${year}-${pad(month)}-${pad(day)}T${pad(h)}:${minute}:${second}+03:00`);
    }
    // BOA: "23/01/26 14:04" or "23/01/2026 14:04"
    const boaMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})$/);
    if (boaMatch) {
        const [, day, month, shortYear, hour, minute] = boaMatch;
        const year = shortYear.length === 2 ? `20${shortYear}` : shortYear;
        return new Date(`${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${minute}:00+03:00`);
    }
    throw new Error(`Unsupported date format: "${raw}"`);
};
exports.parseDate = parseDate;
//# sourceMappingURL=date-parser.util.js.map