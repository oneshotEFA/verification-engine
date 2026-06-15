const assert = require("node:assert/strict");
const test = require("node:test");

const {
  VerificationEngine,
  CbeParser,
  TelebirrParser,
  AbyssiniaParser,
  EBirrParser,
} = require("../dist");

test("built-in parsers build links from transaction references", () => {
  assert.equal(
    new CbeParser().transactionRef("FT26093JCD32", "1000000018872366").link,
    "https://apps.cbe.com.et:100/?id=FT26093JCD3218872366",
  );

  assert.equal(
    new TelebirrParser().transactionRef("CG7X9A2B").link,
    "https://transactioninfo.ethiotelecom.et/receipt/CG7X9A2B",
  );

  assert.equal(
    new AbyssiniaParser().transactionRef("FT12345ABCD1", "987654321").link,
    "https://cs.bankofabyssinia.com/slip/?trx=FT12345ABCD154321",
  );

  assert.equal(
    new EBirrParser().transactionRef("EB12345678").link,
    "https://transactioninfo.ebirr.com/kaafimf-Ebirr/receipt/EB12345678",
  );
});

test("engine supports TRANSACTION_REF and validates amount", async () => {
  const parser = {
    transactionRef(ref) {
      return { link: `https://bank.test/${ref}` };
    },
    extract() {
      return { link: "" };
    },
    async fetch(link, context) {
      assert.equal(link, "https://bank.test/ABC123");
      assert.equal(context.countryCode, "ET");
      assert.ok(context.fetcher);
      return { page: "<html></html>" };
    },
    async receiptParser() {
      return {
        bank: "TEST",
        receipt: {
          transactionNumber: "ABC123",
          date: "2026-06-15",
          amount: "500.00",
          receiverAccount: "1000",
          receiverName: "Receiver",
        },
      };
    },
  };

  const engine = new VerificationEngine({ parsers: { TEST: parser } });
  const result = await engine.verify({
    bank: "TEST",
    amount: 500,
    verMethod: "TRANSACTION_REF",
    rawProof: "ABC123",
  });

  assert.equal(result.status, "SUCCESS");
});

test("engine fails when parsed amount does not match expected amount", async () => {
  const parser = {
    extract() {
      return { link: "https://bank.test/receipt" };
    },
    async fetch() {
      return { page: "" };
    },
    async receiptParser() {
      return {
        bank: "TEST",
        receipt: {
          transactionNumber: "ABC123",
          date: "2026-06-15",
          amount: "10.00",
          receiverAccount: "1000",
          receiverName: "Receiver",
        },
      };
    },
  };

  const engine = new VerificationEngine({ parsers: { TEST: parser } });
  const result = await engine.verify({
    bank: "TEST",
    amount: 500,
    verMethod: "LINK",
    rawProof: "https://bank.test/receipt",
  });

  assert.equal(result.status, "FAIL");
  assert.match(result.reason, /does not match expected amount/);
});

test("engine runs OCR before extracting a receipt link", async () => {
  let extractedText = "";
  const parser = {
    extract(text) {
      extractedText = text;
      return { link: "https://bank.test/from-ocr" };
    },
    async fetch() {
      return { page: "" };
    },
    async receiptParser() {
      return {
        bank: "TEST",
        receipt: {
          transactionNumber: "OCR123",
          date: "2026-06-15",
          amount: "42",
          receiverAccount: "1000",
          receiverName: "Receiver",
        },
      };
    },
  };

  const engine = new VerificationEngine({
    parsers: { TEST: parser },
    ocrReader: async () => "your transaction number is OCR123",
  });

  const result = await engine.verify({
    bank: "TEST",
    amount: 42,
    verMethod: "OCR",
    rawProof: Buffer.from("fake image"),
  });

  assert.equal(result.status, "SUCCESS");
  assert.equal(extractedText, "your transaction number is OCR123");
});
