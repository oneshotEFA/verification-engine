import { ParserRegistry } from "../shared/parser.interface";
/**
 * Master parser registry — maps parserKey → parser instance.
 *
 * TO ADD A NEW COUNTRY:
 *   1. Create src/parsers/<country>/<bank>.parser.ts
 *   2. Create src/parsers/<country>/index.ts and export the registry
 *   3. Spread it into this object below
 *
 * That's it — the extraction engine picks it up automatically.
 */
export declare const PARSER_REGISTRY: ParserRegistry;
//# sourceMappingURL=index.d.ts.map