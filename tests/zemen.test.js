import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { validateReceiptUrl } from "../dist/validation/validate-receipt-url.js";
import { ZEMEN_CONFIG } from "../dist/validation/ethiopia/zemen/config.js";
import { ZemenParser } from "../dist/parsers/ethiopia/zemen.parser.js";

// ------------------------------------------------------------------
// URL Validation Tests
// ------------------------------------------------------------------
describe("Zemen URL Validation", () => {
  it("should accept valid receipt URL (alpha-numeric ref)", () => {
    const result = validateReceiptUrl(
      "https://share.zemenbank.com/rt/ZM987654321/pdf",
      ZEMEN_CONFIG,
    );
    assert.ok(result.includes("share.zemenbank.com"));
  });

  it("should accept valid receipt URL (longer reference)", () => {
    const result = validateReceiptUrl(
      "https://share.zemenbank.com/rt/ABC1234567890XYZ/pdf",
      ZEMEN_CONFIG,
    );
    assert.ok(result.includes("share.zemenbank.com"));
  });

  it("should reject http (non-https)", () => {
    assert.throws(
      () =>
        validateReceiptUrl(
          "http://share.zemenbank.com/rt/ZM987654321/pdf",
          ZEMEN_CONFIG,
        ),
      { message: "Only HTTPS URLs are allowed." },
    );
  });

  it("should reject unknown domain", () => {
    assert.throws(
      () =>
        validateReceiptUrl("https://evil.com/rt/ZM987654321/pdf", ZEMEN_CONFIG),
      { message: "Unrecognized receipt domain." },
    );
  });

  it("should reject missing /rt/ path", () => {
    assert.throws(
      () =>
        validateReceiptUrl(
          "https://share.zemenbank.com/ZM987654321/pdf",
          ZEMEN_CONFIG,
        ),
      { message: /Invalid Zemen receipt URL format/ },
    );
  });

  it("should reject missing /pdf suffix", () => {
    assert.throws(
      () =>
        validateReceiptUrl(
          "https://share.zemenbank.com/rt/ZM987654321",
          ZEMEN_CONFIG,
        ),
      { message: /Invalid Zemen receipt URL format/ },
    );
  });

  it("should reject too-short reference", () => {
    assert.throws(
      () =>
        validateReceiptUrl(
          "https://share.zemenbank.com/rt/ABC12/pdf",
          ZEMEN_CONFIG,
        ),
      { message: "Invalid Zemen receipt reference format." },
    );
  });

  it("should reject empty string", () => {
    assert.throws(() => validateReceiptUrl("", ZEMEN_CONFIG), {
      message: "No URL provided.",
    });
  });

  it("should reject malformed URL", () => {
    assert.throws(() => validateReceiptUrl("not-a-url", ZEMEN_CONFIG), {
      message: "Invalid URL format.",
    });
  });
});

// ------------------------------------------------------------------
// Parser Tests
// ------------------------------------------------------------------
describe("Zemen Parser", () => {
  const parser = new ZemenParser();

  // --- extract() ---
  describe("extract()", () => {
    it("should extract link from SMS with full URL", () => {
      const sms =
        "Dear Customer, your transfer of 2,000 ETB was successful. View receipt: https://share.zemenbank.com/rt/ZM987654321/pdf";
      const { link } = parser.extract(sms);
      assert.equal(link, "https://share.zemenbank.com/rt/ZM987654321/pdf");
    });

    it("should extract link from SMS with broken URL spacing", () => {
      const sms =
        "Receipt: https :// share.zemenbank.com / rt / ZM987654321 / pdf";
      const { link } = parser.extract(sms);
      assert.equal(link, "https://share.zemenbank.com/rt/ZM987654321/pdf");
    });

    it("should extract reference fallback when no full URL", () => {
      const text = "Your ref is ZM987654321 for the transfer";
      const { link } = parser.extract(text);
      assert.equal(link, "https://share.zemenbank.com/rt/ZM987654321/pdf");
    });

    it("should return empty link when no match found", () => {
      const { link } = parser.extract("No receipt info here");
      assert.equal(link, "");
    });
  });

  // --- transactionRef() ---
  describe("transactionRef()", () => {
    it("should build URL from reference", () => {
      const { link } = parser.transactionRef("ZM987654321");
      assert.equal(link, "https://share.zemenbank.com/rt/ZM987654321/pdf");
    });

    it("should uppercase the ref", () => {
      const { link } = parser.transactionRef("zm987654321");
      assert.equal(link, "https://share.zemenbank.com/rt/ZM987654321/pdf");
    });

    it("should pass through full URL", () => {
      const { link } = parser.transactionRef(
        "https://share.zemenbank.com/rt/ZM987654321/pdf",
      );
      assert.equal(link, "https://share.zemenbank.com/rt/ZM987654321/pdf");
    });
  });

  // --- receiptParser() ---
  describe("receiptParser()", () => {
    it("should throw on null input", async () => {
      await assert.rejects(() => parser.receiptParser(null), {
        message: /No receipt data to parse/,
      });
    });

    it("should throw on empty buffer", async () => {
      await assert.rejects(() => parser.receiptParser(Buffer.alloc(0)), {
        message: /Failed to parse Zemen PDF/,
      });
    });
  });
});
