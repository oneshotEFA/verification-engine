import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { validateReceiptUrl } from "../dist/validation/validate-receipt-url.js";
import { EBIRR_CONFIG } from "../dist/validation/ethiopia/ebirr/config.js";

describe("EBirr URL Validation", () => {
  it("should accept valid receipt url", () => {
    const result = validateReceiptUrl(
      "https://my.ebirr.com/receipt/12345",
      EBIRR_CONFIG,
    );
    assert.ok(result.includes("receipt"));
  });

  it("should reject http", () => {
    assert.throws(
      () =>
        validateReceiptUrl("http://my.ebirr.com/receipt/12345", EBIRR_CONFIG),
      { message: "Only HTTPS URLs are allowed." },
    );
  });

  it("should reject unknown domains", () => {
    assert.throws(
      () => validateReceiptUrl("https://evil.com/receipt/12345", EBIRR_CONFIG),
      { message: "Unrecognized receipt domain." },
    );
  });

  it("should reject missing receipt path", () => {
    assert.throws(
      () =>
        validateReceiptUrl("https://my.ebirr.com/payment/12345", EBIRR_CONFIG),
      { message: "The link does not appear to be an EBirr receipt." },
    );
  });

  it("should reject empty string", () => {
    assert.throws(() => validateReceiptUrl("", EBIRR_CONFIG), {
      message: "No URL provided.",
    });
  });

  it("should reject malformed url", () => {
    assert.throws(() => validateReceiptUrl("not-a-url", EBIRR_CONFIG), {
      message: "Invalid URL format.",
    });
  });
});
