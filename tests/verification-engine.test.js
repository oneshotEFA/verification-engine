/**
 * @localpay/verification-engine — test suite
 *
 * Uses Node.js built-in test runner (node:test + node:assert/strict).
 * Run with: npm test
 */

const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const {
  VerificationEngine,
  CbeParser,
  TelebirrParser,
  AbyssiniaParser,
  EBirrParser,
  BankFetchService,
  FetchError,
  ProxyType,
  safeParsDate,
  parseDate,
  PARSER_REGISTRY,
} = require("../dist");

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A passthrough UrlValidationConfig for the "TEST" bank.
 * The engine looks up URL_VALIDATION_REGISTRY[bank] — since "TEST" is not a
 * real bank, we inject this via the new `urlValidators` constructor option so
 * the engine can proceed past the URL validation gate in unit tests.
 */
const TEST_URL_VALIDATOR = {
  domains: ["bank.test", "custom.test"],
  validate: () => {}, // always passes
};

/** Convenience: the urlValidators map every mock-based test needs */
const TEST_URL_VALIDATORS = { TEST: TEST_URL_VALIDATOR };

/** Build a minimal mock parser for VerificationEngine routing tests */
function mockParser({
  extractedLink = "https://bank.test/receipt",
  transactionRefLink = null,
  amount = "500.00",
} = {}) {
  return {
    extract: () => ({ link: extractedLink }),
    transactionRef: transactionRefLink
      ? () => ({ link: transactionRefLink })
      : undefined,
    fetch: async () => ({ page: "<html></html>" }),
    receiptParser: async () => ({
      bank: "TEST",
      receipt: {
        transactionNumber: "TXN001",
        date: "2026-06-15",
        amount,
        receiverAccount: "1000",
        receiverName: "Test Receiver",
      },
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. date-parser.util
// ─────────────────────────────────────────────────────────────────────────────

describe("safeParsDate", () => {
  it("returns null for null input", () => {
    assert.equal(safeParsDate(null), null);
  });

  it("returns null for empty string", () => {
    assert.equal(safeParsDate(""), null);
  });

  it("returns null for whitespace-only string", () => {
    assert.equal(safeParsDate("   "), null);
  });

  it("returns null for an unrecognised format", () => {
    assert.equal(safeParsDate("not a date at all"), null);
  });

  it("parses eBirr format correctly", () => {
    const d = safeParsDate("2026-02-11 20:07:02 +0300 EAT");
    assert.ok(d instanceof Date);
    assert.ok(!isNaN(d.getTime()));
    assert.equal(d.getUTCFullYear(), 2026);
    assert.equal(d.getUTCMonth(), 1);
    assert.equal(d.getUTCDate(), 11);
  });

  it("parses Telebirr DD-MM-YYYY format correctly", () => {
    const d = safeParsDate("18-03-2026 21:46:09");
    assert.ok(d instanceof Date);
    assert.equal(d.getUTCFullYear(), 2026);
    assert.equal(d.getUTCMonth(), 2);
    assert.equal(d.getUTCDate(), 18);
  });

  it("parses CBE PDF AM/PM format correctly", () => {
    const d = safeParsDate("3/11/2026, 6:15:00 PM");
    assert.ok(d instanceof Date);
    assert.equal(d.getUTCFullYear(), 2026);
  });

  it("parses BOA short-year format correctly", () => {
    const d = safeParsDate("23/01/26 14:04");
    assert.ok(d instanceof Date);
    assert.equal(d.getUTCFullYear(), 2026);
    assert.equal(d.getUTCMonth(), 0);
    assert.equal(d.getUTCDate(), 23);
  });

  it("parses BOA long-year format correctly", () => {
    const d = safeParsDate("23/01/2026 14:04");
    assert.ok(d instanceof Date);
    assert.equal(d.getUTCFullYear(), 2026);
  });
});

describe("parseDate — throws on bad input", () => {
  it("throws on empty string", () => {
    assert.throws(() => parseDate(""), /Invalid date input/);
  });

  it("throws on unrecognised format", () => {
    assert.throws(
      () => parseDate("Monday 6th June"),
      /Unsupported date format/,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Parser.extract()
// ─────────────────────────────────────────────────────────────────────────────

describe("CbeParser.extract()", () => {
  const parser = new CbeParser();

  it("extracts new-format CBE link from URL", () => {
    const text = "https://Mbreciept.cbe.com.et/FT26093JCD32-18872366";
    const { link } = parser.extract(text);
    assert.equal(link, "https://mbreciept.cbe.com.et/FT26093JCD32-18872366");
  });

  it("extracts old-format CBE link from SMS URL", () => {
    const text =
      "You have transfered ETB 1.00 https://apps.cbe.com.et:100/?id=FT260876DYXB80798625";
    const { link } = parser.extract(text);
    assert.ok(link.includes("apps.cbe.com.et:100"));
    assert.ok(link.includes("FT260876DYXB80798625"));
  });

  it("appends account suffix when reference is 12 chars", () => {
    const { link } = parser.extract(
      "transaction ID: FT26093JCD32",
      "1000000018872366",
    );
    assert.ok(link.includes("FT26093JCD3218872366"));
  });

  it("throws when no transaction reference is found", () => {
    assert.throws(() => parser.extract("no reference here"), /No valid CBE/);
  });
});

describe("TelebirrParser.extract()", () => {
  const parser = new TelebirrParser();

  it("extracts from SMS format", () => {
    const sms =
      "Dear Ephrem\nYou have transferred ETB 600.00 to asefa aynalem on 31/05/2026. Your transaction number is DEV6HKJX7K.";
    const { link } = parser.extract(sms);
    assert.equal(
      link,
      "https://transactioninfo.ethiotelecom.et/receipt/DEV6HKJX7K",
    );
  });

  it("extracts from app share format", () => {
    const text = "Transaction Number: DCO46NY1PU\nTransaction Time: 2026/03/24";
    const { link } = parser.extract(text);
    assert.equal(
      link,
      "https://transactioninfo.ethiotelecom.et/receipt/DCO46NY1PU",
    );
  });

  it("returns empty link when no reference found", () => {
    const { link } = parser.extract("Hello world no tx here");
    assert.equal(link, "");
  });
});

describe("AbyssiniaParser.extract()", () => {
  const parser = new AbyssiniaParser();

  it("extracts from SMS URL with trx param", () => {
    const sms =
      "Dear Ephrem, your account was debited.\nReceipt: https://cs.bankofabyssinia.com/slip/?trx=FT261461TFF867816";
    const { link } = parser.extract(sms);
    assert.ok(link.includes("cs.bankofabyssinia.com/slip/"));
    assert.ok(link.includes("FT261461TFF"));
  });

  it("appends account suffix when reference is 12 chars", () => {
    const { link } = parser.extract(
      "Transaction Reference FT12345ABCD1",
      "987654321",
    );
    assert.ok(link.includes("FT12345ABCD154321"));
  });

  it("returns empty link when no reference found", () => {
    const { link } = parser.extract("No transaction here");
    assert.equal(link, "");
  });
});

describe("EBirrParser.extract()", () => {
  const parser = new EBirrParser();

  it("extracts receipt URL from SMS", () => {
    const sms =
      "[-EBIRR-KAAFI-]\nTransfer ID :801970278984 ETB200 sent to Yosef\nhttps://transactioninfo.ebirr.com/kaafimf-Ebirr/receipt/EB12345678901";
    const { link } = parser.extract(sms);
    assert.equal(
      link,
      "https://transactioninfo.ebirr.com/kaafimf-Ebirr/receipt/EB12345678901",
    );
  });

  it("returns empty link when no receipt URL found", () => {
    const { link } = parser.extract("Transfer ID :801970278984 ETB200 sent");
    assert.equal(link, "");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Parser.transactionRef()
// ─────────────────────────────────────────────────────────────────────────────

describe("Parser.transactionRef() — all four banks", () => {
  it("CbeParser: appends account last-8 when ref is 12 chars", () => {
    const { link } = new CbeParser().transactionRef(
      "FT26093JCD32",
      "1000000018872366",
    );
    assert.equal(link, "https://apps.cbe.com.et:100/?id=FT26093JCD3218872366");
  });

  it("CbeParser: uses ref as-is when longer than 12 chars", () => {
    const { link } = new CbeParser().transactionRef("FT26093JCD3218872366");
    assert.equal(link, "https://apps.cbe.com.et:100/?id=FT26093JCD3218872366");
  });

  it("TelebirrParser: builds correct receipt URL", () => {
    const { link } = new TelebirrParser().transactionRef("DEV6HKJX7K");
    assert.equal(
      link,
      "https://transactioninfo.ethiotelecom.et/receipt/DEV6HKJX7K",
    );
  });

  it("TelebirrParser: uppercases and strips non-alphanumeric chars", () => {
    const { link } = new TelebirrParser().transactionRef("dev6-hkjx7k");
    assert.equal(
      link,
      "https://transactioninfo.ethiotelecom.et/receipt/DEV6HKJX7K",
    );
  });

  it("AbyssiniaParser: appends account suffix when ref is 12 chars", () => {
    const { link } = new AbyssiniaParser().transactionRef(
      "FT12345ABCD1",
      "987654321",
    );
    assert.equal(
      link,
      "https://cs.bankofabyssinia.com/slip/?trx=FT12345ABCD154321",
    );
  });

  it("EBirrParser: builds correct receipt URL", () => {
    const { link } = new EBirrParser().transactionRef("EB12345678");
    assert.equal(
      link,
      "https://transactioninfo.ebirr.com/kaafimf-Ebirr/receipt/EB12345678",
    );
  });

  it("EBirrParser: uppercases the reference", () => {
    const { link } = new EBirrParser().transactionRef("eb12345678");
    assert.equal(
      link,
      "https://transactioninfo.ebirr.com/kaafimf-Ebirr/receipt/EB12345678",
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. VerificationEngine — LINK method
// ─────────────────────────────────────────────────────────────────────────────

describe("VerificationEngine — LINK method", () => {
  it("passes link directly to fetch, returns SUCCESS", async () => {
    const engine = new VerificationEngine({
      parsers: { TEST: mockParser({ amount: "250" }) },
      urlValidators: TEST_URL_VALIDATORS,
    });
    const result = await engine.verify({
      bank: "TEST",
      amount: 250,
      verMethod: "LINK",
      rawProof: "https://bank.test/receipt",
    });
    assert.equal(result.status, "SUCCESS");
    assert.equal(result.receipt.bank, "TEST");
    assert.equal(result.receipt.receipt.transactionNumber, "TXN001");
  });

  it("fails with clear message for unknown bank", async () => {
    const engine = new VerificationEngine();
    const result = await engine.verify({
      bank: "UNKNOWN_BANK",
      amount: 100,
      verMethod: "LINK",
      rawProof: "https://bank.test/receipt",
    });
    assert.equal(result.status, "FAIL");
    assert.match(result.reason, /No parser registered for bank: UNKNOWN_BANK/);
  });

  it("passes countryCode from payload to fetch context", async () => {
    let capturedCountry = "";
    const parser = {
      extract: () => ({ link: "" }),
      fetch: async (_link, ctx) => {
        capturedCountry = ctx.countryCode;
        return { page: "" };
      },
      receiptParser: async () => ({
        bank: "TEST",
        receipt: {
          transactionNumber: "T1",
          date: "",
          amount: "100",
          receiverAccount: "",
          receiverName: "",
        },
      }),
    };
    const engine = new VerificationEngine({
      parsers: { TEST: parser },
      urlValidators: TEST_URL_VALIDATORS,
    });
    await engine.verify({
      bank: "TEST",
      amount: 100,
      verMethod: "LINK",
      rawProof: "https://bank.test",
      countryCode: "KE",
    });
    assert.equal(capturedCountry, "KE");
  });

  it("defaults countryCode to ET when not provided", async () => {
    let capturedCountry = "";
    const parser = {
      extract: () => ({ link: "" }),
      fetch: async (_link, ctx) => {
        capturedCountry = ctx.countryCode;
        return { page: "" };
      },
      receiptParser: async () => ({
        bank: "TEST",
        receipt: {
          transactionNumber: "T1",
          date: "",
          amount: "100",
          receiverAccount: "",
          receiverName: "",
        },
      }),
    };
    const engine = new VerificationEngine({
      parsers: { TEST: parser },
      urlValidators: TEST_URL_VALIDATORS,
    });
    await engine.verify({
      bank: "TEST",
      amount: 100,
      verMethod: "LINK",
      rawProof: "https://bank.test",
      // countryCode intentionally omitted — should default to "ET"
    });
    assert.equal(capturedCountry, "ET");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. VerificationEngine — SMS method
// ─────────────────────────────────────────────────────────────────────────────

describe("VerificationEngine — SMS method", () => {
  it("calls extract() then fetch(), returns SUCCESS", async () => {
    let extractCalled = false;
    const parser = {
      extract: (text) => {
        extractCalled = true;
        assert.ok(text.includes("transaction number"));
        return { link: "https://bank.test/receipt" };
      },
      fetch: async () => ({ page: "" }),
      receiptParser: async () => ({
        bank: "TEST",
        receipt: {
          transactionNumber: "T1",
          date: "",
          amount: "100",
          receiverAccount: "",
          receiverName: "",
        },
      }),
    };
    const engine = new VerificationEngine({
      parsers: { TEST: parser },
      urlValidators: TEST_URL_VALIDATORS,
    });
    const result = await engine.verify({
      bank: "TEST",
      amount: 100,
      verMethod: "SMS",
      rawProof: "your transaction number is ABC123",
    });
    assert.ok(extractCalled);
    assert.equal(result.status, "SUCCESS");
  });

  it("fails when extract() returns empty link", async () => {
    const engine = new VerificationEngine({
      parsers: {
        TEST: {
          extract: () => ({ link: "" }),
          fetch: async () => ({ page: "" }),
          receiptParser: async () => ({
            bank: "T",
            receipt: {
              transactionNumber: "",
              date: "",
              amount: "0",
              receiverAccount: "",
              receiverName: "",
            },
          }),
        },
      },
      urlValidators: TEST_URL_VALIDATORS,
    });
    const result = await engine.verify({
      bank: "TEST",
      amount: 100,
      verMethod: "SMS",
      rawProof: "no link here",
    });
    assert.equal(result.status, "FAIL");
    assert.match(result.reason, /Could not extract link from SMS/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. VerificationEngine — TRANSACTION_REF method
// ─────────────────────────────────────────────────────────────────────────────

describe("VerificationEngine — TRANSACTION_REF method", () => {
  it("uses transactionRef() when available", async () => {
    let refCalled = false;
    const parser = {
      extract: () => ({ link: "" }),
      transactionRef: (ref, accNum) => {
        refCalled = true;
        assert.equal(ref, "FT26093JCD32");
        assert.equal(accNum, "1000000018872366");
        return { link: "https://bank.test/ft-receipt" };
      },
      fetch: async () => ({ page: "" }),
      receiptParser: async () => ({
        bank: "TEST",
        receipt: {
          transactionNumber: "FT26093JCD32",
          date: "",
          amount: "500",
          receiverAccount: "",
          receiverName: "",
        },
      }),
    };
    const engine = new VerificationEngine({
      parsers: { TEST: parser },
      urlValidators: TEST_URL_VALIDATORS,
    });
    const result = await engine.verify({
      bank: "TEST",
      amount: 500,
      verMethod: "TRANSACTION_REF",
      rawProof: "FT26093JCD32",
      accountNumber: "1000000018872366",
    });
    assert.ok(refCalled);
    assert.equal(result.status, "SUCCESS");
  });

  it("falls back to extract() when transactionRef() is not defined", async () => {
    let extractCalled = false;
    const parser = {
      extract: (text) => {
        extractCalled = true;
        return { link: `https://bank.test/${text}` };
      },
      fetch: async () => ({ page: "" }),
      receiptParser: async () => ({
        bank: "TEST",
        receipt: {
          transactionNumber: "T1",
          date: "",
          amount: "100",
          receiverAccount: "",
          receiverName: "",
        },
      }),
    };
    const engine = new VerificationEngine({
      parsers: { TEST: parser },
      urlValidators: TEST_URL_VALIDATORS,
    });
    await engine.verify({
      bank: "TEST",
      amount: 100,
      verMethod: "TRANSACTION_REF",
      rawProof: "REF123",
    });
    assert.ok(extractCalled);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. VerificationEngine — amount validation
// ─────────────────────────────────────────────────────────────────────────────

describe("VerificationEngine — amount validation", () => {
  it("fails when amounts differ beyond default tolerance (0.01)", async () => {
    const engine = new VerificationEngine({
      parsers: { TEST: mockParser({ amount: "10.00" }) },
      urlValidators: TEST_URL_VALIDATORS,
    });
    const result = await engine.verify({
      bank: "TEST",
      amount: 500,
      verMethod: "LINK",
      rawProof: "https://bank.test/receipt",
    });
    assert.equal(result.status, "FAIL");
    assert.match(result.reason, /does not match expected amount/);
  });

  it("passes when amounts match exactly", async () => {
    const engine = new VerificationEngine({
      parsers: { TEST: mockParser({ amount: "500.00" }) },
      urlValidators: TEST_URL_VALIDATORS,
    });
    const result = await engine.verify({
      bank: "TEST",
      amount: 500,
      verMethod: "LINK",
      rawProof: "https://bank.test/receipt",
    });
    assert.equal(result.status, "SUCCESS");
  });

  it("passes when difference is within default tolerance", async () => {
    const engine = new VerificationEngine({
      parsers: { TEST: mockParser({ amount: "500.005" }) },
      urlValidators: TEST_URL_VALIDATORS,
    });
    const result = await engine.verify({
      bank: "TEST",
      amount: 500,
      verMethod: "LINK",
      rawProof: "https://bank.test/receipt",
    });
    assert.equal(result.status, "SUCCESS");
  });

  it("respects custom amountTolerance", async () => {
    const engine = new VerificationEngine({
      parsers: { TEST: mockParser({ amount: "501.00" }) },
      urlValidators: TEST_URL_VALIDATORS,
    });
    const result = await engine.verify({
      bank: "TEST",
      amount: 500,
      verMethod: "LINK",
      rawProof: "https://bank.test/receipt",
      amountTolerance: 2,
    });
    assert.equal(result.status, "SUCCESS");
  });

  it("strips currency symbols from amount before comparing", async () => {
    const engine = new VerificationEngine({
      parsers: { TEST: mockParser({ amount: "ETB 500.00" }) },
      urlValidators: TEST_URL_VALIDATORS,
    });
    const result = await engine.verify({
      bank: "TEST",
      amount: 500,
      verMethod: "LINK",
      rawProof: "https://bank.test/receipt",
    });
    assert.equal(result.status, "SUCCESS");
  });

  it("strips commas from large amounts before comparing", async () => {
    const engine = new VerificationEngine({
      parsers: { TEST: mockParser({ amount: "9,540.00" }) },
      urlValidators: TEST_URL_VALIDATORS,
    });
    const result = await engine.verify({
      bank: "TEST",
      amount: 9540,
      verMethod: "LINK",
      rawProof: "https://bank.test/receipt",
    });
    assert.equal(result.status, "SUCCESS");
  });

  it("fails when receipt amount is empty", async () => {
    const engine = new VerificationEngine({
      parsers: { TEST: mockParser({ amount: "" }) },
      urlValidators: TEST_URL_VALIDATORS,
    });
    const result = await engine.verify({
      bank: "TEST",
      amount: 100,
      verMethod: "LINK",
      rawProof: "https://bank.test/receipt",
    });
    assert.equal(result.status, "FAIL");
    assert.match(result.reason, /does not match expected amount/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. VerificationEngine — OCR / SCREENSHOT method
// ─────────────────────────────────────────────────────────────────────────────

describe("VerificationEngine — OCR / SCREENSHOT method", () => {
  it("calls ocrReader then passes text to extract()", async () => {
    let ocrInput = null;
    let extractInput = "";

    const parser = {
      extract: (text) => {
        extractInput = text;
        return { link: "https://bank.test/ocr-receipt" };
      },
      fetch: async () => ({ page: "" }),
      receiptParser: async () => ({
        bank: "TEST",
        receipt: {
          transactionNumber: "OCR1",
          date: "",
          amount: "42",
          receiverAccount: "",
          receiverName: "",
        },
      }),
    };

    const engine = new VerificationEngine({
      parsers: { TEST: parser },
      urlValidators: TEST_URL_VALIDATORS,
      ocrReader: async (input) => {
        ocrInput = input;
        return "your transaction number is OCR1";
      },
    });

    const result = await engine.verify({
      bank: "TEST",
      amount: 42,
      verMethod: "OCR",
      rawProof: Buffer.from("fake image bytes"),
    });

    assert.ok(Buffer.isBuffer(ocrInput));
    assert.equal(extractInput, "your transaction number is OCR1");
    assert.equal(result.status, "SUCCESS");
  });

  it("SCREENSHOT method behaves identically to OCR", async () => {
    const engine = new VerificationEngine({
      parsers: { TEST: mockParser({ amount: "100" }) },
      urlValidators: TEST_URL_VALIDATORS,
      ocrReader: async () => "link https://bank.test/receipt",
    });
    const result = await engine.verify({
      bank: "TEST",
      amount: 100,
      verMethod: "SCREENSHOT",
      rawProof: "path/to/image.jpg",
    });
    assert.equal(result.status, "SUCCESS");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. VerificationEngine — error handling
// ─────────────────────────────────────────────────────────────────────────────

describe("VerificationEngine — error handling", () => {
  it("returns FAIL when parser.fetch() throws", async () => {
    const parser = {
      extract: () => ({ link: "https://bank.test/receipt" }),
      fetch: async () => {
        throw new Error("Network timeout");
      },
      receiptParser: async () => ({
        bank: "T",
        receipt: {
          transactionNumber: "",
          date: "",
          amount: "0",
          receiverAccount: "",
          receiverName: "",
        },
      }),
    };
    const engine = new VerificationEngine({
      parsers: { TEST: parser },
      urlValidators: TEST_URL_VALIDATORS,
    });
    const result = await engine.verify({
      bank: "TEST",
      amount: 100,
      verMethod: "LINK",
      rawProof: "https://bank.test/receipt",
    });
    assert.equal(result.status, "FAIL");
    assert.match(result.reason, /Network timeout/);
  });

  it("returns FAIL when receiptParser() returns null", async () => {
    const parser = {
      extract: () => ({ link: "https://bank.test/receipt" }),
      fetch: async () => ({ page: "" }),
      receiptParser: async () => null,
    };
    const engine = new VerificationEngine({
      parsers: { TEST: parser },
      urlValidators: TEST_URL_VALIDATORS,
    });
    const result = await engine.verify({
      bank: "TEST",
      amount: 100,
      verMethod: "LINK",
      rawProof: "https://bank.test/receipt",
    });
    assert.equal(result.status, "FAIL");
    assert.match(result.reason, /Parser returned no receipt data/);
  });

  it("returns FAIL for unsupported verMethod", async () => {
    const engine = new VerificationEngine({
      parsers: { TEST: mockParser() },
      urlValidators: TEST_URL_VALIDATORS,
    });
    const result = await engine.verify({
      bank: "TEST",
      amount: 100,
      verMethod: "UNKNOWN_METHOD",
      rawProof: "x",
    });
    assert.equal(result.status, "FAIL");
    assert.match(result.reason, /Unsupported verification method/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. VerificationEngine — custom parsers and registry
// ─────────────────────────────────────────────────────────────────────────────

describe("VerificationEngine — custom parsers", () => {
  it("getSupportedBanks() returns all registered keys", () => {
    const engine = new VerificationEngine({
      parsers: { BANK_A: mockParser(), BANK_B: mockParser() },
      urlValidators: { BANK_A: TEST_URL_VALIDATOR, BANK_B: TEST_URL_VALIDATOR },
    });
    const banks = engine.getSupportedBanks();
    assert.ok(banks.includes("BANK_A"));
    assert.ok(banks.includes("BANK_B"));
    assert.equal(banks.length, 2);
  });

  it("PARSER_REGISTRY contains all four Ethiopian banks", () => {
    assert.ok("CBE" in PARSER_REGISTRY);
    assert.ok("TELEBIRR" in PARSER_REGISTRY);
    assert.ok("ABYSSINIA" in PARSER_REGISTRY);
    assert.ok("EBIRR" in PARSER_REGISTRY);
  });

  it("allows extending registry with a custom parser", async () => {
    const customParser = mockParser({ amount: "999" });
    const engine = new VerificationEngine({
      parsers: { ...PARSER_REGISTRY, CUSTOM_BANK: customParser },
      urlValidators: { CUSTOM_BANK: TEST_URL_VALIDATOR },
    });
    const banks = engine.getSupportedBanks();
    assert.ok(banks.includes("CUSTOM_BANK"));
    assert.ok(banks.includes("CBE"));

    const result = await engine.verify({
      bank: "CUSTOM_BANK",
      amount: 999,
      verMethod: "LINK",
      rawProof: "https://custom.test/receipt",
    });
    assert.equal(result.status, "SUCCESS");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. BankFetchService — proxy config
// ─────────────────────────────────────────────────────────────────────────────

describe("BankFetchService — proxy resolution", () => {
  it("instantiates without a proxy resolver", () => {
    const svc = new BankFetchService();
    assert.ok(svc);
  });

  it("instantiates with a null proxy resolver", () => {
    const svc = new BankFetchService(null);
    assert.ok(svc);
  });

  it("calls proxyResolver.resolve() with the correct countryCode", async () => {
    let resolvedCode = "";
    const proxyResolver = {
      resolve: async (code) => {
        resolvedCode = code;
        return null;
      },
    };
    const svc = new BankFetchService(proxyResolver);
    try {
      await svc.fetch("http://0.0.0.0:1", "KE", { timeoutMs: 500 });
    } catch (err) {
      assert.ok(err instanceof FetchError);
    }
    assert.equal(resolvedCode, "KE");
  });

  it("FetchError contains the original URL and countryCode", async () => {
    const svc = new BankFetchService(null);
    try {
      await svc.fetch("http://0.0.0.0:1", "ET", { timeoutMs: 500 });
      assert.fail("Expected FetchError to be thrown");
    } catch (err) {
      assert.ok(err instanceof FetchError);
      assert.equal(err.url, "http://0.0.0.0:1");
      assert.equal(err.countryCode, "ET");
      assert.match(err.message, /ET/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. ProxyType enum
// ─────────────────────────────────────────────────────────────────────────────

describe("ProxyType enum", () => {
  it("has HTTP_CONNECT and SOCKS5 values", () => {
    assert.equal(ProxyType.HTTP_CONNECT, "HTTP_CONNECT");
    assert.equal(ProxyType.SOCKS5, "SOCKS5");
  });
});
