"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PARSER_REGISTRY = void 0;
const ethiopia_1 = require("./ethiopia");
const kenya_1 = require("./kenya");
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
exports.PARSER_REGISTRY = {
    ...ethiopia_1.ETHIOPIA_PARSER_REGISTRY,
    ...kenya_1.KENYA_PARSER_REGISTRY,
};
//# sourceMappingURL=index.js.map