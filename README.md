# @localpay/verification-engine

Bank receipt verification engine for Ethiopian and East African banks.

Supports: **CBE**, **Telebirr**, **Bank of Abyssinia**, **E-Birr**

- Works in any Node.js project
- Proxy support via a simple interface (you provide the config, we route the traffic)
- Amount matching built into verification
- Supports receipt links, SMS text, transaction references, and OCR images
- Extensible — add new bank parsers by implementing one interface

---

## Installation

```bash
npm install @localpay/verification-engine
```

---

## Quick start

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
  console.log(result.receipt.receipt.transactionNumber); // FT26093JCD32
  console.log(result.receipt.receipt.amount); // "500"
  console.log(result.receipt.receipt.receiverAccount); // account number
}
```

---

## Supported banks

| parserKey   | Bank                        | Methods                         |
| ----------- | --------------------------- | ------------------------------- |
| `CBE`       | Commercial Bank of Ethiopia | LINK, SMS, TRANSACTION_REF, OCR |
| `TELEBIRR`  | Telebirr                    | LINK, SMS, TRANSACTION_REF, OCR |
| `ABYSSINIA` | Bank of Abyssinia           | LINK, SMS, TRANSACTION_REF, OCR |
| `EBIRR`     | E-Birr                      | LINK, SMS, TRANSACTION_REF, OCR |

---

## Verification methods

| Method            | Description                                         |
| ----------------- | --------------------------------------------------- |
| `LINK`            | Pass the receipt URL directly                       |
| `SMS`             | Pass the raw SMS body — the parser extracts the URL |
| `TRANSACTION_REF` | Pass only the transaction/reference number          |
| `OCR`             | Pass an image path or `Buffer`; OCR runs internally |
| `SCREENSHOT`      | Alias of `OCR` for screenshot image verification    |

```ts
const byReference = await engine.verify({
  bank: "TELEBIRR",
  amount: 250,
  verMethod: "TRANSACTION_REF",
  rawProof: "CG7X9A2B",
});

const byScreenshot = await engine.verify({
  bank: "TELEBIRR",
  amount: 250,
  verMethod: "OCR",
  rawProof: "/tmp/receipt-screenshot.png",
});
```

The engine compares `payload.amount` with the parsed receipt amount. Use
`amountTolerance` when small rounding differences are expected.

```ts
await engine.verify({
  bank: "CBE",
  amount: 500,
  amountTolerance: 0.05,
  verMethod: "LINK",
  rawProof: "https://apps.cbe.com.et:100/?id=...",
});
```

---

## Proxy support

Some banks block foreign IPs (e.g. Telebirr). Implement the `ProxyResolver`
interface to provide per-country proxy config from your data store. The built-in
parsers route HTTP and browser-backed fetches through this fetch service.

```ts
import {
  VerificationEngine,
  ProxyResolver,
  ProxyConfig,
  ProxyType,
} from "@localpay/verification-engine";

class MyProxyResolver implements ProxyResolver {
  async resolve(countryCode: string): Promise<ProxyConfig | null> {
    // Read from your database, config file, environment variable, etc.
    const row = await db.countryProxy.findUnique({ where: { countryCode } });
    if (!row?.proxyEnabled) return null;
    return {
      enabled: true,
      url: row.proxyUrl,
      type: row.proxyType as ProxyType,
    };
  }
}

const engine = new VerificationEngine({
  proxyResolver: new MyProxyResolver(),
});
```

---

## Adding a new bank

1. Implement the `ParserAndExtractor` interface:

```ts
import {
  ParserAndExtractor,
  ParserFetchContext,
  RawReceipt,
} from "@localpay/verification-engine";

export class MyBankParser implements ParserAndExtractor {
  extract(text: string, accountNumber?: string): { link: string } {
    // Extract the receipt URL from SMS/OCR text
    const match = text.match(/my-bank\.com\/receipt\/([A-Z0-9]+)/i);
    if (!match) return { link: "" };
    return { link: `https://my-bank.com/receipt/${match[1]}` };
  }

  transactionRef(transactionRef: string): { link: string } {
    return { link: `https://my-bank.com/receipt/${transactionRef}` };
  }

  async fetch(
    link: string,
    context?: ParserFetchContext,
  ): Promise<{ page: any }> {
    const response = context
      ? await context.fetcher.fetch(link, context.countryCode)
      : await fetch(link).then(async (res) => ({ data: await res.text() }));

    return { page: response.data };
  }

  async receiptParser(
    page: any,
  ): Promise<{ bank: string; receipt: RawReceipt }> {
    // Parse the page and return structured data
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

2. Pass it to the engine:

```ts
import { PARSER_REGISTRY } from "@localpay/verification-engine";
import { MyBankParser } from "./my-bank.parser";

const engine = new VerificationEngine({
  parsers: {
    ...PARSER_REGISTRY,
    MY_BANK: new MyBankParser(),
  },
});
```

---

## NestJS integration

```ts
import { Injectable } from "@nestjs/common";
import {
  VerificationEngine,
  ProxyResolver,
} from "@localpay/verification-engine";
import { PrismaService } from "./prisma.service";

@Injectable()
export class VerificationService {
  private readonly engine: VerificationEngine;

  constructor(private readonly prisma: PrismaService) {
    const proxyResolver: ProxyResolver = {
      resolve: async (countryCode) => {
        const row = await prisma.countryProxy.findUnique({
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

## Publishing

```bash
# Build and test
npm test

# Publish (private)
npm publish --access restricted

# Make public later
npm publish --access public
```

`puppeteer` is an optional peer dependency used by parsers that need a
browser-rendered receipt page. HTTP/PDF-only parsers do not load it. Install it
in host apps that verify Telebirr or Bank of Abyssinia browser-rendered receipts.
