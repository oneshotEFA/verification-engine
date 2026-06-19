<div align="center">
<img src="https://res.cloudinary.com/dghrszcz9/image/upload/v1781601985/logo_l9vw1h.jpg" alt="LocalPay" width="72" height="72" />

  
# @localpay/verification-engine

**Bank receipt verification engine for Ethiopian and East African banks**

[![npm version](https://img.shields.io/npm/v/@localpay/verification-engine?color=00C896&labelColor=0D1117&style=flat-square)](https://www.npmjs.com/package/@localpay/verification-engine)
[![npm downloads](https://img.shields.io/npm/dm/@localpay/verification-engine?color=00C896&labelColor=0D1117&style=flat-square)](https://www.npmjs.com/package/@localpay/verification-engine)
[![License: MIT](https://img.shields.io/badge/license-MIT-00C896?labelColor=0D1117&style=flat-square)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-00C896?labelColor=0D1117&style=flat-square)](https://nodejs.org)
[![docs](https://img.shields.io/badge/docs-localpay-00C896?labelColor=0D1117&style=flat-square)](https://local-pay-ten.vercel.app)
[![CI](https://img.shields.io/github/actions/workflow/status/oneshotEFA/verification-engine/ci.yml?branch=publish&label=CI&color=00C896&labelColor=0D1117&style=flat-square)](https://github.com/oneshotEFA/verification-engine/actions)

<p>
Verify Ethiopian bank transfer receipts in real time.<br/>
Supports SMS, receipt links, transaction references, and OCR screenshots.<br/>
Zero framework dependencies — works in any Node.js project.
</p>

[Installation](#installation) · [Quick Start](#quick-start) · [Supported Banks](#supported-banks) · [Verification Methods](#verification-methods) · [URL Validation](#url-validation) · [Proxy Support](#proxy-support) · [Adding a Bank](#adding-a-new-bank) · [NestJS](#nestjs-integration)

</div>

---

## Features

- 🏦 **4 Ethiopian banks** — CBE, Telebirr, Bank of Abyssinia, E-Birr
- 🔗 **5 verification methods** — LINK, SMS, TRANSACTION_REF, OCR, SCREENSHOT
- 🛡️ **Automatic URL validation** — domain allowlist + structural checks before any network call
- 🌍 **Proxy support** — per-country routing via a simple interface
- ✅ **Amount matching** — configurable tolerance, strips currency symbols and commas automatically
- 🔌 **Zero framework lock-in** — plain TypeScript, no NestJS, no Prisma
- 🧩 **Extensible** — add any bank parser by implementing one interface
- 📦 **Tree-shakeable** — `sideEffects: false`

---

## Installation

```bash
npm install @localpay/verification-engine
```

> **Optional:** Install `puppeteer` only if you verify **Telebirr** or **Bank of Abyssinia**
> receipts — those banks serve JavaScript-rendered pages requiring a headless browser.

```bash
npm install puppeteer
```

Requires **Node.js ≥ 20**.

---

## Quick Start

```ts
import { VerificationEngine } from "@localpay/verification-engine";

const engine = new VerificationEngine();

const result = await engine.verify({
  bank: "CBE",
  amount: 500,
  verMethod: "LINK",
  rawProof: "https://apps.cbe.com.et:100/?id=FT26093JCD3218872366",
});

if (result.status === "SUCCESS") {
  console.log(result.receipt.bank);                      // "CBE"
  console.log(result.receipt.transactionNumber); // "FT26093JCD32..."
  console.log(result.receipt.amount);            // "500"
  console.log(result.receipt.receiverAccount);   // account number
  console.log(result.receipt.receiverName);      // account holder name
  console.log(result.receipt.date);              // raw date string
}

if (result.status === "FAIL") {
  console.error(result.reason);
}
```

---

## Supported Banks

| Bank | `parserKey` | Methods |
|------|------------|---------|
| Commercial Bank of Ethiopia | `CBE` | LINK · SMS · TRANSACTION_REF · OCR · SCREENSHOT |
| Telebirr | `TELEBIRR` | LINK · SMS · TRANSACTION_REF · OCR · SCREENSHOT |
| Bank of Abyssinia | `ABYSSINIA` | LINK · SMS · TRANSACTION_REF · OCR · SCREENSHOT |
| E-Birr | `EBIRR` | LINK · SMS · TRANSACTION_REF · OCR · SCREENSHOT |

---

## Verification Methods

| Method | `verMethod` | Pass as `rawProof` |
|--------|------------|-------------------|
| Receipt URL | `LINK` | Full HTTPS URL |
| SMS body | `SMS` | Raw SMS text string |
| Transaction reference | `TRANSACTION_REF` | Transaction or reference number |
| Image (OCR) | `OCR` | File path string or `Buffer` |
| Screenshot | `SCREENSHOT` | Alias of `OCR` — identical behaviour |

### By link

```ts
await engine.verify({
  bank: "CBE",
  amount: 500,
  verMethod: "LINK",
  rawProof: "https://apps.cbe.com.et:100/?id=FT26093JCD3218872366",
});
```

### By SMS

```ts
await engine.verify({
  bank: "TELEBIRR",
  amount: 250,
  verMethod: "SMS",
  rawProof:
    "Dear Ephrem, You have transferred ETB 250.00. Your transaction number is DEV6HKJX7K.",
});
```

### By transaction reference

```ts
await engine.verify({
  bank: "TELEBIRR",
  amount: 250,
  verMethod: "TRANSACTION_REF",
  rawProof: "DEV6HKJX7K",
});
```

> **CBE note:** A 12-character base reference (e.g. `FT26093JCD32`) requires
> `accountNumber` so the engine can build the full receipt URL.

```ts
await engine.verify({
  bank: "CBE",
  amount: 500,
  verMethod: "TRANSACTION_REF",
  rawProof: "FT26093JCD32",
  accountNumber: "1000000018872366",
});
```

### By screenshot / OCR

```ts
await engine.verify({
  bank: "CBE",
  amount: 500,
  verMethod: "OCR",
  rawProof: "/tmp/receipt.png", // or a Buffer
});
```

Supply a custom `ocrReader` for higher accuracy:

```ts
const engine = new VerificationEngine({
  ocrReader: async (input) => {
    return myVisionApi.recognize(input);
  },
});
```

### Amount tolerance

```ts
await engine.verify({
  bank: "CBE",
  amount: 500,
  amountTolerance: 0.05, // default is 0.01
  verMethod: "LINK",
  rawProof: "https://...",
});
// Currency symbols and commas stripped automatically:
// "ETB 9,540.00" → compared as 9540.00
```

---

## URL Validation

Every receipt URL is validated before the parser makes any network request.
Three checks run automatically for every built-in bank:

1. **Protocol** must be `https`
2. **Domain** must be on the bank's allowed list
3. **URL structure** must pass the bank-specific `validate()` function

| Bank | Allowed domains |
|------|----------------|
| `CBE` | `apps.cbe.com.et`, `mbreciept.cbe.com.et` |
| `TELEBIRR` | `transactioninfo.ethiotelecom.et` |
| `EBIRR` | `my.ebirr.com` |
| `ABYSSINIA` | `cs.bankofabyssinia.com` |

No config needed for built-in banks. For custom banks, pass `urlValidators`:

```ts
import {
  VerificationEngine,
  URL_VALIDATION_REGISTRY,
  UrlValidationConfig,
} from "@localpay/verification-engine";

const MY_BANK_CONFIG: UrlValidationConfig = {
  domains: ["receipts.my-bank.et"],
  validate(parsed: URL) {
    if (!parsed.searchParams.get("ref")) {
      throw new Error("Missing receipt reference.");
    }
  },
};

const engine = new VerificationEngine({
  urlValidators: {
    ...URL_VALIDATION_REGISTRY, // keep all built-in validators
    MY_BANK: MY_BANK_CONFIG,
  },
});
```

---

## Proxy Support

Some banks block foreign IPs (e.g. Telebirr). Implement `ProxyResolver` to
provide per-country proxy config from your own data store:

```ts
import {
  VerificationEngine,
  ProxyResolver,
  ProxyConfig,
  ProxyType,
} from "@localpay/verification-engine";

class MyProxyResolver implements ProxyResolver {
  async resolve(countryCode: string): Promise<ProxyConfig | null> {
    const row = await db.countryProxy.findUnique({ where: { countryCode } });
    if (!row?.proxyEnabled) return null;
    return {
      enabled: true,
      url: row.proxyUrl,                 // "http://user:pass@proxy.host:8080"
      type: row.proxyType as ProxyType,  // HTTP_CONNECT or SOCKS5
    };
  }
}

const engine = new VerificationEngine({
  proxyResolver: new MyProxyResolver(),
});
```

`ProxyType.HTTP_CONNECT` is the default. Use `SOCKS5` when the bank does
deep packet inspection or blocks CONNECT tunnels.

---

## Adding a New Bank

Implement `ParserAndExtractor`:

```ts
import {
  ParserAndExtractor,
  ParserFetchContext,
  RawReceipt,
  PARSER_REGISTRY,
  VerificationEngine,
} from "@localpay/verification-engine";

export class MyBankParser implements ParserAndExtractor {
  extract(text: string, accountNumber?: string): { link: string } {
    const match = text.match(/my-bank\.et\/receipt\/([A-Z0-9]+)/i);
    if (!match) return { link: "" };
    return { link: `https://my-bank.et/receipt/${match[1]}` };
  }

  transactionRef(ref: string): { link: string } {
    return { link: `https://my-bank.et/receipt/${ref.toUpperCase()}` };
  }

  async fetch(link: string, context?: ParserFetchContext): Promise<{ page: any }> {
    const response = await context?.fetcher.fetch(link, context.countryCode);
    return { page: response?.data };
  }

  async receiptParser(page: any): Promise<{ bank: string; receipt: RawReceipt }> {
    return {
      bank: "MY_BANK",
      receipt: {
        transactionNumber: "...",
        date: "...",
        amount: "...",
        receiverAccount: "...",
        receiverName: "...",
      },
    };
  }
}

const engine = new VerificationEngine({
  parsers: { ...PARSER_REGISTRY, MY_BANK: new MyBankParser() },
});
```

Check registered banks:

```ts
engine.getSupportedBanks();
// → ["CBE", "TELEBIRR", "ABYSSINIA", "EBIRR", "MY_BANK"]
```

---

## NestJS Integration

```ts
import { Injectable } from "@nestjs/common";
import { VerificationEngine, ProxyResolver } from "@localpay/verification-engine";
import { PrismaService } from "./prisma.service";

@Injectable()
export class VerificationService {
  private readonly engine: VerificationEngine;

  constructor(private readonly prisma: PrismaService) {
    const proxyResolver: ProxyResolver = {
      resolve: async (countryCode) => {
        const row = await this.prisma.countryProxy.findUnique({
          where: { countryCode },
        });
        if (!row?.proxyEnabled) return null;
        return { enabled: true, url: row.proxyUrl, type: row.proxyType as any };
      },
    };
    this.engine = new VerificationEngine({ proxyResolver });
  }

  verify(payload: Parameters<VerificationEngine["verify"]>[0]) {
    return this.engine.verify(payload);
  }
}
```

---

## API Reference

### `new VerificationEngine(options?)`

| Option | Type | Description |
|--------|------|-------------|
| `proxyResolver` | `ProxyResolver \| null` | Per-country proxy config provider |
| `ocrReader` | `(input: RawProof) => Promise<string>` | Custom OCR function — defaults to tesseract.js |
| `parsers` | `ParserRegistry` | Override or extend the parser registry |
| `urlValidators` | `Record<string, UrlValidationConfig>` | Override or extend URL validators per bank |

### `engine.verify(payload)`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bank` | `string` | ✅ | Parser key — `CBE`, `TELEBIRR`, `ABYSSINIA`, `EBIRR` |
| `amount` | `number` | ✅ | Expected transfer amount |
| `verMethod` | `VerificationMethod` | ✅ | `LINK \| SMS \| TRANSACTION_REF \| OCR \| SCREENSHOT` |
| `rawProof` | `string \| Buffer` | ✅ | URL, SMS text, ref number, file path, or Buffer |
| `accountNumber` | `string` | — | Sender account — required for CBE 12-char refs |
| `countryCode` | `string` | — | ISO country code for proxy routing. Default: `ET` |
| `amountTolerance` | `number` | — | Max allowed amount difference. Default: `0.01` |

### Result type

```ts
type VerifyResult =
  | { status: "SUCCESS"; receipt: { bank: string; receipt: RawReceipt } }
  | { status: "FAIL";    reason: string }
```

### `RawReceipt`

```ts
interface RawReceipt {
  transactionNumber: string;
  date:              string; // use safeParsDate() to convert to Date
  amount:            string; // may include currency symbol
  receiverAccount:   string;
  receiverName:      string;
}
```

---

## Utilities

```ts
import { safeParsDate, parseDate } from "@localpay/verification-engine";

safeParsDate("18-03-2026 21:46:09");           // → Date  (Telebirr)
safeParsDate("2026-02-11 20:07:02 +0300 EAT"); // → Date  (eBirr)
safeParsDate("3/11/2026, 6:15:00 PM");         // → Date  (CBE PDF)
safeParsDate("23/01/26 14:04");                // → Date  (BOA)
safeParsDate("not a date");                    // → null  (never throws)

parseDate("not a date"); // → throws: Unsupported date format
```

---

## Contributing

```bash
git clone https://github.com/oneshotEFA/verification-engine.git
cd verification-engine
npm install
npm run build
npm test
```

**Flow:**
```
feature-branch → PR to cont → tests pass → merge → npm version patch → git push --follow-tags → auto-publish
```

Adding a bank: create parser → add to country registry → spread into master registry → add tests.

---

## License

[MIT](./LICENSE) · Built by [LocalPay](https://github.com/oneshotEFA)
