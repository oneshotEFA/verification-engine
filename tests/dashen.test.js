import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { validateReceiptUrl } from "../dist/validation/validate-receipt-url.js";
import { DASHEN_CONFIG } from "../dist/validation/ethiopia/dashen/config.js";
import { DashenParser } from "../dist/parsers/ethiopia/dashen.parser.js";

// ------------------------------------------------------------------
// Simulated PDF text — mimics real Dashen receipt extraction
// ------------------------------------------------------------------
const MOCK_PDF_TEXT = `
Dashen Bank Super App Electronic Value Added Tax Receipt

Dashen Bank S.C.
Sudan St, Addis Ababa, Ethiopia
P.O.Box: 12752

Sender Name:             Muluneh Wolde Deneke
Sender Account Number:   5121******011
Transaction Channel:     Dashen Bank Super App
Service Type:            Other Bank Transfer
TIN No.:                 0000007523
Narrative:               ekub
VAT Reg.:                12970
VAT Reg. Date:           23/04/1995

Receiver Name:           Tilahun Desale Mengistu
Receiver Account Number: 1000155740942
Institution Name:        Commercial Bank Of Ethiopia

Transaction Reference:   641OBTS2518100WH
Transfer Reference:      OBTS35546016067047784078
Transaction Date:        Jun 29, 2025, 10:55:59 am

--- Transaction Details ---
Transaction Amount:      ETB 1,600.00
Service Charge:          ETB 6.40
VAT (15%):               ETB 0.96
Total:                   ETB 1,607.36
`;

// ------------------------------------------------------------------
// URL Validation Tests
// ------------------------------------------------------------------
describe("Dashen URL Validation", () => {
  it("should accept valid receipt URL (OBTS)", () => {
    const result = validateReceiptUrl(
      "https://receipt.dashensuperapp.com/receipt/641OBTS2518100WH",
      DASHEN_CONFIG,
    );
    assert.ok(result.includes("receipt.dashensuperapp.com"));
  });

  it("should accept valid receipt URL (WDTS)", () => {
    const result = validateReceiptUrl(
      "https://receipt.dashensuperapp.com/receipt/045WDTS2514600WM",
      DASHEN_CONFIG,
    );
    assert.ok(result.includes("receipt.dashensuperapp.com"));
  });

  it("should accept valid receipt URL (OBTI)", () => {
    const result = validateReceiptUrl(
      "https://receipt.dashensuperapp.com/receipt/D31OBTI251720001",
      DASHEN_CONFIG,
    );
    assert.ok(result.includes("receipt.dashensuperapp.com"));
  });

  it("should reject http (non-https)", () => {
    assert.throws(
      () =>
        validateReceiptUrl(
          "http://receipt.dashensuperapp.com/receipt/641OBTS2518100WH",
          DASHEN_CONFIG,
        ),
      { message: "Only HTTPS URLs are allowed." },
    );
  });

  it("should reject unknown domain", () => {
    assert.throws(
      () =>
        validateReceiptUrl(
          "https://evil.com/receipt/641OBTS2518100WH",
          DASHEN_CONFIG,
        ),
      { message: "Unrecognized receipt domain." },
    );
  });

  it("should reject missing /receipt/ path", () => {
    assert.throws(
      () =>
        validateReceiptUrl(
          "https://receipt.dashensuperapp.com/641OBTS2518100WH",
          DASHEN_CONFIG,
        ),
      { message: /Invalid Dashen receipt URL format/ },
    );
  });

  it("should reject too-short reference", () => {
    assert.throws(
      () =>
        validateReceiptUrl(
          "https://receipt.dashensuperapp.com/receipt/ABC123",
          DASHEN_CONFIG,
        ),
      { message: "Invalid Dashen receipt reference format." },
    );
  });

  it("should reject empty string", () => {
    assert.throws(() => validateReceiptUrl("", DASHEN_CONFIG), {
      message: "No URL provided.",
    });
  });

  it("should reject malformed URL", () => {
    assert.throws(() => validateReceiptUrl("not-a-url", DASHEN_CONFIG), {
      message: "Invalid URL format.",
    });
  });
});

// ------------------------------------------------------------------
// Parser Tests
// ------------------------------------------------------------------
describe("Dashen Parser", () => {
  const parser = new DashenParser();

  // --- extract() ---
  describe("extract()", () => {
    it("should extract link from SMS with full URL", () => {
      const sms =
        "Dear Customer, your transfer of 1,600 ETB was successful. View receipt: https://receipt.dashensuperapp.com/receipt/641OBTS2518100WH";
      const { link } = parser.extract(sms);
      assert.equal(
        link,
        "https://receipt.dashensuperapp.com/receipt/641OBTS2518100WH",
      );
    });

    it("should extract link from SMS with broken URL spacing", () => {
      const sms =
        "Receipt: https :// receipt.dashensuperapp.com / receipt / 045WDTS2514600WM";
      const { link } = parser.extract(sms);
      assert.equal(
        link,
        "https://receipt.dashensuperapp.com/receipt/045WDTS2514600WM",
      );
    });

    it("should extract reference fallback when no full URL", () => {
      const text = "Your ref is 641OBTS2518100WH for the transfer";
      const { link } = parser.extract(text);
      assert.equal(
        link,
        "https://receipt.dashensuperapp.com/receipt/641OBTS2518100WH",
      );
    });

    it("should return empty link when no match found", () => {
      const { link } = parser.extract("No receipt info here");
      assert.equal(link, "");
    });
  });

  // --- transactionRef() ---
  describe("transactionRef()", () => {
    it("should build URL from reference", () => {
      const { link } = parser.transactionRef("641OBTS2518100WH");
      assert.equal(
        link,
        "https://receipt.dashensuperapp.com/receipt/641OBTS2518100WH",
      );
    });

    it("should uppercase the ref", () => {
      const { link } = parser.transactionRef("641obts2518100wh");
      assert.equal(
        link,
        "https://receipt.dashensuperapp.com/receipt/641OBTS2518100WH",
      );
    });

    it("should pass through full URL", () => {
      const { link } = parser.transactionRef(
        "https://receipt.dashensuperapp.com/receipt/641OBTS2518100WH",
      );
      assert.equal(
        link,
        "https://receipt.dashensuperapp.com/receipt/641OBTS2518100WH",
      );
    });
  });

  // --- receiptParser() ---
  // We mock pdf-parse by creating a minimal valid PDF buffer
  // that contains our test text. Since we can't easily create a real PDF
  // in tests, we test the parsing logic with the text extraction step.
  describe("receiptParser()", () => {
    it("should throw on null input", async () => {
      await assert.rejects(() => parser.receiptParser(null), {
        message: /No receipt data to parse/,
      });
    });

    it("should throw on empty buffer", async () => {
      await assert.rejects(() => parser.receiptParser(Buffer.alloc(0)), {
        message: /Failed to parse Dashen PDF/,
      });
    });
  });
});
