import { ParserRegistry } from "../../shared/parser.interface";
import { CbeParser } from "./cbe.parser";
import { TelebirrParser } from "./telebirr.parser";
import { AbyssiniaParser } from "./abyssinia.parser";
import { EBirrParser } from "./ebirr.parser";
import { AwashParser } from "./awash.parser";
import { ZemenParser } from "./zemen.parser";
import { DashenParser } from "./dashen.parser";

export const ETHIOPIA_PARSER_REGISTRY: ParserRegistry = {
  CBE: new CbeParser(),
  TELEBIRR: new TelebirrParser(),
  ABYSSINIA: new AbyssiniaParser(),
  EBIRR: new EBirrParser(),
  AWASH: new AwashParser(),
  DASHEN: new DashenParser(),
  ZEMEN: new ZemenParser(),
};
