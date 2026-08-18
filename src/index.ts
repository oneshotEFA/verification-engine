// ── Main entry point ─────────────────────────────────────────────────────────
export { VerificationEngine } from "./core/verification-engine";
export type {
  VerifyPayload,
  VerifyResult,
  VerificationMethod,
} from "./core/verification-engine";

// ── HTTP fetcher ──────────────────────────────────────────────────────────────
export { BankFetchService, FetchError } from "./core/bank-fetch.service";
export type { BankFetchOptions } from "./core/bank-fetch.service";

// ── Parsers ───────────────────────────────────────────────────────────────────
export { PARSER_REGISTRY } from "./parsers";
export { CbeParser } from "./parsers/ethiopia/cbe.parser";
export { TelebirrParser } from "./parsers/ethiopia/telebirr.parser";
export { AbyssiniaParser } from "./parsers/ethiopia/abyssinia.parser";
export { EBirrParser } from "./parsers/ethiopia/ebirr.parser";
export { AwashParser } from "./parsers/ethiopia/awash.parser";
export { DashenParser } from "./parsers/ethiopia/dashen.parser";
export { ZemenParser } from "./parsers/ethiopia/zemen.parser";
// ── Shared types & interfaces ─────────────────────────────────────────────────
export type {
  ParserAndExtractor,
  ParserFetchContext,
  ParserRegistry,
  RawReceipt,
} from "./shared/parser.interface";
export type { ProxyConfig, ProxyResolver } from "./shared/proxy.types";
export { ProxyType } from "./shared/proxy.types";

// ── Utilities ─────────────────────────────────────────────────────────────────
export { safeParsDate, parseDate } from "./shared/date-parser.util";
