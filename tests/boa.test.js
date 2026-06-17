import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { validateReceiptUrl } from "../dist/validation/validate-receipt-url.js";
import { BOA_CONFIG } from "../dist/validation/ethiopia/boa/config.js";

describe("BOA URL Validation", () => {
  it("should accept valid receipt url", () => {
    const result = validateReceiptUrl(
      "https://cs.bankofabyssinia.com/receipt/12345",
      BOA_CONFIG,
    );
    assert.ok(result.includes("receipt"));
  });

  it("should reject http", () => {
    assert.throws(
      () =>
        validateReceiptUrl(
          "http://cs.bankofabyssinia.com/receipt/12345",
          BOA_CONFIG,
        ),
      { message: "Only HTTPS URLs are allowed." },
    );
  });

  it("should reject unknown domains", () => {
    assert.throws(
      () => validateReceiptUrl("https://evil.com/receipt/12345", BOA_CONFIG),
      { message: "Unrecognized receipt domain." },
    );
  });

  it("should reject missing receipt path", () => {
    assert.throws(
      () =>
        validateReceiptUrl(
          "https://cs.bankofabyssinia.com/payment/12345",
          BOA_CONFIG,
        ),
      { message: "The link does not appear to be a BOA receipt." },
    );
  });

  it("should reject empty string", () => {
    assert.throws(() => validateReceiptUrl("", BOA_CONFIG), {
      message: "No URL provided.",
    });
  });

  it("should reject malformed url", () => {
    assert.throws(() => validateReceiptUrl("not-a-url", BOA_CONFIG), {
      message: "Invalid URL format.",
    });
  });
});
