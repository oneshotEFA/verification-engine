import { ParserRegistry } from "../../shared/parser.interface";
import { CbeParser } from "./cbe.parser";
import { TelebirrParser } from "./telebirr.parser";
import { AbyssiniaParser } from "./abyssinia.parser";
import { EBirrParser } from "./ebirr.parser";

export const ETHIOPIA_PARSER_REGISTRY: ParserRegistry = {
  CBE: new CbeParser(),
  TELEBIRR: new TelebirrParser(),
  ABYSSINIA: new AbyssiniaParser(),
  EBIRR: new EBirrParser(),
};
