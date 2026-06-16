<div align="center">

<img src="https://res.cloudinary.com/dghrszcz9/image/upload/v1781601985/logo_l9vw1h.jpg" alt="LocalPay" width="72" height="72" />

# @localpay/verification-engine

**Bank receipt verification engine for Ethiopian banks**

[![npm version](https://img.shields.io/npm/v/@localpay/verification-engine?color=00C896&labelColor=0D1117&style=flat-square)](https://www.npmjs.com/package/@localpay/verification-engine)
[![npm downloads](https://img.shields.io/npm/dm/@localpay/verification-engine?color=00C896&labelColor=0D1117&style=flat-square)](https://www.npmjs.com/package/@localpay/verification-engine)
[![License: MIT](https://img.shields.io/badge/license-MIT-00C896?labelColor=0D1117&style=flat-square)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-00C896?labelColor=0D1117&style=flat-square)](https://nodejs.org)
[![CI](https://img.shields.io/github/actions/workflow/status/oneshotEFA/verification-engine/ci.yml?branch=publish&label=CI&color=00C896&labelColor=0D1117&style=flat-square)](https://github.com/oneshotEFA/verification-engine/actions)

<p>
Verify bank transfer receipts in real time — from SMS, links, transaction IDs, or screenshots.<br/>
No framework lock-in. Works in any Node.js project.
</p>

[Installation](#installation) · [Quick Start](#quick-start) · [Supported Banks](#supported-banks) · [Verification Methods](#verification-methods) · [Proxy Support](#proxy-support) · [Adding a Bank](#adding-a-new-bank) · [NestJS](#nestjs-integration)

</div>

---

## Features

- 🏦 **4 Ethiopian banks** — CBE, Telebirr, Bank of Abyssinia, E-Birr
- 🔗 **5 verification methods** — link, SMS, transaction reference, OCR, screenshot
- 🌍 **Proxy support** — per-country routing for banks that block foreign IPs
- ✅ **Amount matching** — configurable tolerance, strips currency symbols automatically
- 🔌 **Zero framework lock-in** — plain TypeScript, no NestJS, no Prisma
- 🧩 **Extensible** — add any bank by implementing one interface
- 📦 **Tree-shakeable** — `sideEffects: false`

---

## Installation

```bash
npm install @localpay/verification-engine
```

> **Optional:** Install `puppeteer` if you verify **Telebirr** or **Bank of Abyssinia** receipts.
> These banks serve JavaScript-rendered pages that require a headless browser.

```bash
npm install puppeteer
```

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
  console.log(result.receipt.receipt.transactionNumber); // "FT26093JCD32"
  console.log(result.receipt.receipt.amount);            // "500"
  console.log(result.receipt.receipt.receiverAccount);   // account number
  console.log(result.receipt.receipt.receiverName);      // account holder name
}

if (result.status === "FAIL") {
  console.error(result.reason); // human-readable failure reason
}
```

---

## Supported Banks

| Bank | `parserKey` | Methods |
|------|------------|---------|
| Commercial Bank of Ethiopia | `CBE` | LINK · SMS · TRANSACTION_REF · OCR |
| Telebirr | `TELEBIRR` | LINK · SMS · TRANSACTION_REF · OCR |
| Bank of Abyssinia | `ABYSSINIA` | LINK · SMS · TRANSACTION_REF · OCR |
| E-Birr | `EBIRR` | LINK · SMS · TRANSACTION_REF · OCR |

---

## Verification Methods

| Method | `verMethod` | Pass as `rawProof` |
|--------|------------|-------------------|
| Receipt URL | `LINK` | Full URL string |
| SMS body | `SMS` | Raw SMS text string |
| Transaction reference | `TRANSACTION_REF` | Transaction / reference number |
| Image (OCR) | `OCR` | File path string or `Buffer` |
| Screenshot | `SCREENSHOT` | Alias of `OCR` |

### By link

```ts
const result = await engine.verify({
  bank: "CBE",
  amount: 500,
  verMethod: "LINK",
  rawProof: "https://apps.cbe.com.et:100/?id=FT26093JCD3218872366",
});
```

### By SMS

```ts
const result = await engine.verify({
  bank: "TELEBIRR",
  amount: 250,
  verMethod: "SMS",
  rawProof:
    "Dear Ephrem, You have transferred ETB 250.00. Your transaction number is DEV6HKJX7K.",
});
```

### By transaction reference

```ts
const result = await engine.verify({
  bank: "TELEBIRR",
  amount: 250,
  verMethod: "TRANSACTION_REF",
  rawProof: "DEV6HKJX7K",
});
```

> **CBE note:** When passing a 12-character base reference (e.g. `FT26093JCD32`),
> also provide `accountNumber` so the engine can build the full receipt URL.

```ts
const result = await engine.verify({
  bank: "CBE",
  amount: 500,
  verMethod: "TRANSACTION_REF",
  rawProof: "FT26093JCD32",
  accountNumber: "1000000018872366",
});
```

### By screenshot / OCR

```ts
const result = await engine.verify({
  bank: "CBE",
  amount: 500,
  verMethod: "OCR",
  rawProof: "/tmp/receipt-screenshot.png", // or a Buffer
});
```

> OCR uses Tesseract.js internally by default.
> Supply a custom `ocrReader` for higher accuracy (e.g. Google Cloud Vision):

```ts
const engine = new VerificationEngine({
  ocrReader: async (input) => {
    // input is a string path or Buffer
    const text = await myVisionApi.recognize(input);
    return text;
  },
});
```

### Amount tolerance

The engine compares `payload.amount` with the parsed receipt amount.
Use `amountTolerance` when small rounding differences are expected.

```ts
await engine.verify({
  bank: "CBE",
  amount: 500,
  amountTolerance: 0.05, // default is 0.01
  verMethod: "LINK",
  rawProof: "https://...",
});
```

---

## Proxy Support

Some banks (notably Telebirr) block requests from foreign IP addresses.
Implement the `ProxyResolver` interface to provide per-country proxy config
from your own data store. The engine resolves it transparently — parsers
never deal with proxy config directly.

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
      url: row.proxyUrl,           // "http://user:pass@proxy.host:8080"
      type: row.proxyType as ProxyType, // HTTP_CONNECT or SOCKS5
    };
  }
}

const engine = new VerificationEngine({
  proxyResolver: new MyProxyResolver(),
});
```

Both `HTTP_CONNECT` (default) and `SOCKS5` proxy types are supported.
Proxy config is resolved per request — toggling it in your database
takes effect immediately with no redeploy.

---

## Adding a New Bank

Implement the `ParserAndExtractor` interface:

```ts
import {
  ParserAndExtractor,
  ParserFetchContext,
  RawReceipt,
} from "@localpay/verification-engine";

export class MyBankParser implements ParserAndExtractor {
  /** Extract receipt URL from SMS body or OCR text */
  extract(text: string, accountNumber?: string): { link: string } {
    const match = text.match(/my-bank\.com\/receipt\/([A-Z0-9]+)/i);
    if (!match) return { link: "" };
    return { link: `https://my-bank.com/receipt/${match[1]}` };
  }

  /** Build receipt URL directly from a transaction reference */
  transactionRef(ref: string): { link: string } {
    return { link: `https://my-bank.com/receipt/${ref}` };
  }

  /** Download the receipt page — always use context.fetcher for proxy support */
  async fetch(link: string, context?: ParserFetchContext): Promise<{ page: any }> {
    const response = context
      ? await context.fetcher.fetch(link, context.countryCode)
      : await fetch(link).then(async (r) => ({ data: await r.text() }));
    return { page: response.data };
  }

  /** Parse the page into a structured receipt */
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
```

Pass it to the engine alongside the built-in parsers:

```ts
import { VerificationEngine, PARSER_REGISTRY } from "@localpay/verification-engine";
import { MyBankParser } from "./my-bank.parser";

const engine = new VerificationEngine({
  parsers: {
    ...PARSER_REGISTRY,   // keep all built-in banks
    MY_BANK: new MyBankParser(),
  },
});
```

Check registered banks at runtime:

```ts
engine.getSupportedBanks();
// → ["CBE", "TELEBIRR", "ABYSSINIA", "EBIRR", "MY_BANK"]
```

---

## NestJS Integration

The engine is a plain class — wrap it in a NestJS service:

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
| `ocrReader` | `(input: RawProof) => Promise<string>` | Custom OCR function |
| `parsers` | `ParserRegistry` | Override or extend the parser registry |

### `engine.verify(payload)`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bank` | `string` | ✅ | Parser key e.g. `"CBE"`, `"TELEBIRR"` |
| `amount` | `number` | ✅ | Expected transfer amount |
| `verMethod` | `VerificationMethod` | ✅ | How to verify |
| `rawProof` | `string \| Buffer` | ✅ | The proof to verify |
| `accountNumber` | `string` | — | Sender account (CBE 12-char refs) |
| `countryCode` | `string` | — | ISO country code, defaults to `"ET"` |
| `amountTolerance` | `number` | — | Amount diff tolerance, defaults to `0.01` |

### Result

```ts
type VerifyResult =
  | { status: "SUCCESS"; receipt: { bank: string; receipt: RawReceipt } }
  | { status: "FAIL";    reason: string };
```

### `RawReceipt`

```ts
interface RawReceipt {
  transactionNumber: string;
  date:              string;
  amount:            string;
  receiverAccount:   string;
  receiverName:      string;
}
```

---

## Utilities

```ts
import { safeParsDate, parseDate } from "@localpay/verification-engine";

// Returns null instead of throwing on bad input
safeParsDate("18-03-2026 21:46:09"); // → Date object
safeParsDate("not a date");          // → null

// Throws on unrecognised format
parseDate("18-03-2026 21:46:09");    // → Date object
```

Supported date formats:

| Bank | Format example |
|------|---------------|
| eBirr | `2026-02-11 20:07:02 +0300 EAT` |
| Telebirr | `18-03-2026 21:46:09` |
| CBE PDF | `3/11/2026, 6:15:00 PM` |
| BOA | `23/01/26 14:04` · `23/01/2026 14:04` |

---

## Contributing

```bash
# Clone and install
git clone https://github.com/oneshotEFA/verification-engine.git
cd verification-engine
npm install

# Build
npm run build

# Run tests
npm test

# Type-check only
npm run lint
```

To add a new bank:

1. Create `src/parsers/<country>/<bank>.parser.ts`
2. Implement `ParserAndExtractor`
3. Export from `src/parsers/<country>/index.ts`
4. Spread into `src/parsers/index.ts`
5. Add test cases in `tests/verification-engine.test.js`

---

## License

[MIT](./LICENSE) · Built by [LocalPay](https://github.com/oneshotEFA)
