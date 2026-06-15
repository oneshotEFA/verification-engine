import { ParserRegistry } from "../shared/parser.interface";
import { ETHIOPIA_PARSER_REGISTRY } from "./ethiopia";
import { KENYA_PARSER_REGISTRY } from "./kenya";

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
export const PARSER_REGISTRY: ParserRegistry = {
  ...ETHIOPIA_PARSER_REGISTRY,
  ...KENYA_PARSER_REGISTRY,
};
