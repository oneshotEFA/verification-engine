import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { validateReceiptUrl } from "../dist/validation/validate-receipt-url.js";
import { CBE_CONFIG } from "../dist/validation/ethiopia/cbe/config.js";

describe("CBE URL Validation", () => {
  it("should accept old receipt format", () => {
    const result = validateReceiptUrl(
      "https://apps.cbe.com.et:100/?id=FT26093JCD3218872366",
      CBE_CONFIG,
    );
    assert.ok(result.includes("apps.cbe.com.et"));
  });

  it("should accept new receipt format", () => {
    const result = validateReceiptUrl(
      "https://mbreciept.cbe.com.et/FT26093JCD3218872366",
      CBE_CONFIG,
    );
    assert.ok(result.includes("mbreciept.cbe.com.et"));
  });

  it("should reject http", () => {
    assert.throws(
      () =>
        validateReceiptUrl("http://apps.cbe.com.et:100/?id=123", CBE_CONFIG),
      { message: "Only HTTPS URLs are allowed." },
    );
  });

  it("should reject unknown domains", () => {
    assert.throws(
      () => validateReceiptUrl("https://evil.com/?id=123", CBE_CONFIG),
      { message: "Unrecognized receipt domain." },
    );
  });

  it("should reject invalid port", () => {
    assert.throws(
      () =>
        validateReceiptUrl("https://apps.cbe.com.et:300/?id=123", CBE_CONFIG),
      { message: "Invalid CBE receipt port." },
    );
  });

  it("should reject missing receipt id", () => {
    assert.throws(
      () => validateReceiptUrl("https://apps.cbe.com.et:100/", CBE_CONFIG),
      { message: "Missing receipt ID." },
    );
  });
});
