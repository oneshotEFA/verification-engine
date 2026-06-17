import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { validateReceiptUrl } from "../dist/validation/validate-receipt-url.js";
import { TELEBIRR_CONFIG } from "../dist/validation/ethiopia/telebirr/config.js";

describe("Telebirr URL Validation", () => {
  it("should accept valid receipt url", () => {
    const result = validateReceiptUrl(
      "https://transactioninfo.ethiotelecom.et/receipt/12345",
      TELEBIRR_CONFIG,
    );
    assert.ok(result.includes("receipt"));
  });

  it("should reject http", () => {
    assert.throws(
      () =>
        validateReceiptUrl(
          "http://transactioninfo.ethiotelecom.et/receipt/12345",
          TELEBIRR_CONFIG,
        ),
      { message: "Only HTTPS URLs are allowed." },
    );
  });

  it("should reject unknown domains", () => {
    assert.throws(
      () =>
        validateReceiptUrl("https://evil.com/receipt/12345", TELEBIRR_CONFIG),
      { message: "Unrecognized receipt domain." },
    );
  });

  it("should reject missing receipt path", () => {
    assert.throws(
      () =>
        validateReceiptUrl(
          "https://transactioninfo.ethiotelecom.et/payment/12345",
          TELEBIRR_CONFIG,
        ),
      { message: "The link does not appear to be a Telebirr receipt." },
    );
  });

  it("should reject empty string", () => {
    assert.throws(() => validateReceiptUrl("", TELEBIRR_CONFIG), {
      message: "No URL provided.",
    });
  });

  it("should reject malformed url", () => {
    assert.throws(() => validateReceiptUrl("not-a-url", TELEBIRR_CONFIG), {
      message: "Invalid URL format.",
    });
  });
});
