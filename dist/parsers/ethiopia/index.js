"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ETHIOPIA_PARSER_REGISTRY = void 0;
const cbe_parser_1 = require("./cbe.parser");
const telebirr_parser_1 = require("./telebirr.parser");
const abyssinia_parser_1 = require("./abyssinia.parser");
const ebirr_parser_1 = require("./ebirr.parser");
exports.ETHIOPIA_PARSER_REGISTRY = {
    CBE: new cbe_parser_1.CbeParser(),
    TELEBIRR: new telebirr_parser_1.TelebirrParser(),
    ABYSSINIA: new abyssinia_parser_1.AbyssiniaParser(),
    EBIRR: new ebirr_parser_1.EBirrParser(),
};
//# sourceMappingURL=index.js.map