import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { validateReceiptUrl } from "../dist/validation/validate-receipt-url.js";
import { AWASH_CONFIG } from "../dist/validation/ethiopia/awash/config.js";
import { AwashParser } from "../dist/parsers/ethiopia/awash.parser.js";

// ------------------------------------------------------------------
// Sample HTML — mimics the real Awash receipt page structure
// ------------------------------------------------------------------
const MOCK_RECEIPT_HTML = `
<!DOCTYPE html>
<html>
<head><title>Transaction Successful</title></head>
<body>
  <table class="info-table">
    <tr><td><tt><span>Company Name</span></tt></td><td>:</td><td>Awash Bank Share Company</td></tr>
    <tr><td><tt><span>TIN No</span></tt></td><td>:</td><td>0000030100</td></tr>
    <tr><td><tt><span>VAT Reg No</span></tt></td><td>:</td><td>17264</td></tr>
    <tr><td><tt><span>PO Box</span></tt></td><td>:</td><td>12638</td></tr>
  </table>

  <table class="info-table">
    <tr><td><tt><span>Customer Name</span></tt></td><td>:</td><td>Yilma Abera Shenkute</td></tr>
    <tr><td><tt><span>Account No</span></tt></td><td>:</td><td>01336******600/BANK</td></tr>
    <tr><td><tt><span>Branch</span></tt></td><td>:</td><td>Head Office Branch</td></tr>
  </table>

  <table class="info-table">
    <tr><td><tt><span>Transaction Time</span></tt></td><td>:</td><td>2025-07-28 09:52:44 AM</td></tr>
    <tr><td><tt><span>Transaction Type</span></tt></td><td>:</td><td>Other Bank Transfer</td></tr>
    <tr><td><tt><span>Amount</span></tt></td><td>:</td><td>500 ETB</td></tr>
    <tr><td><tt><span>Charge</span></tt></td><td>:</td><td>3 ETB</td></tr>
    <tr><td><tt><span>VAT</span></tt></td><td>:</td><td>0.45 ETB</td></tr>
    <tr><td><tt><span>Sender Name</span></tt></td><td>:</td><td>YILMA ABERA SHENKUTE</td></tr>
    <tr><td><tt><span>Sender Account</span></tt></td><td>:</td><td>01336******600</td></tr>
    <tr><td><tt><span>Beneficiary name</span></tt></td><td>:</td><td>OBSE ASRAT ZEGEYE</td></tr>
    <tr><td><tt><span>Beneficiary Account</span></tt></td><td>:</td><td>1000303451726</td></tr>
    <tr><td><tt><span>Beneficiary Bank</span></tt></td><td>:</td><td>COMMERCIAL BANK OF ETHIOPIA</td></tr>
    <tr><td><tt><span>Reason</span></tt></td><td>:</td><td>help</td></tr>
    <tr><td><tt><span>Transaction ID</span></tt></td><td>:</td><td>E4092F0CEBDB</td></tr>
  </table>
</body>
</html>
`;

// 2026-style receipt (newer transaction ID format)
const MOCK_RECEIPT_2026_HTML = `
<!DOCTYPE html>
<html>
<head><title>Transaction Successful</title></head>
<body>
  <table class="info-table">
    <tr><td><tt><span>Company Name</span></tt></td><td>:</td><td>Awash Bank Share Company</td></tr>
    <tr><td><tt><span>TIN No</span></tt></td><td>:</td><td>0000030100</td></tr>
  </table>
  <table class="info-table">
    <tr><td><tt><span>Customer Name</span></tt></td><td>:</td><td>HIRUT ALEMU CHEGO</td></tr>
    <tr><td><tt><span>Account No</span></tt></td><td>:</td><td>01347*******600</td></tr>
  </table>
  <table class="info-table">
    <tr><td><tt><span>Transaction Time</span></tt></td><td>:</td><td>2026-04-08 05:47:13 PM</td></tr>
    <tr><td><tt><span>Transaction Type</span></tt></td><td>:</td><td>IPS Bank Transfer</td></tr>
    <tr><td><tt><span>Amount</span></tt></td><td>:</td><td>1,350 ETB</td></tr>
    <tr><td><tt><span>VAT</span></tt></td><td>:</td><td>1.22 ETB</td></tr>
    <tr><td><tt><span>Sender Name</span></tt></td><td>:</td><td>HIRUT ALEMU CHEGO</td></tr>
    <tr><td><tt><span>Sender Account</span></tt></td><td>:</td><td>01347*******600</td></tr>
    <tr><td><tt><span>Beneficiary name</span></tt></td><td>:</td><td>MELKAMU GEMECHU</td></tr>
    <tr><td><tt><span>Beneficiary Account</span></tt></td><td>:</td><td>1000358356722</td></tr>
    <tr><td><tt><span>Beneficiary Bank</span></tt></td><td>:</td><td>Commercial Bank of Ethiopia</td></tr>
    <tr><td><tt><span>Reason</span></tt></td><td>:</td><td>3537</td></tr>
    <tr><td><tt><span>Transaction ID</span></tt></td><td>:</td><td>260408174669917</td></tr>
  </table>
</body>
</html>
`;

// ------------------------------------------------------------------
// URL Validation Tests
// ------------------------------------------------------------------
describe("Awash URL Validation", () => {
  it("should accept valid receipt URL (hex token)", () => {
    const result = validateReceiptUrl(
      "https://awashpay.awashbank.com:8225/-E4092F0CEBDB-205TGG",
      AWASH_CONFIG,
    );
    assert.ok(result.includes("awashpay.awashbank.com"));
  });

  it("should accept valid receipt URL (base36 token)", () => {
    const result = validateReceiptUrl(
      "https://awashpay.awashbank.com:8225/-2KDL95Z0NR-4U61O6",
      AWASH_CONFIG,
    );
    assert.ok(result.includes("awashpay.awashbank.com"));
  });

  it("should reject http (non-https)", () => {
    assert.throws(
      () =>
        validateReceiptUrl(
          "http://awashpay.awashbank.com:8225/-E4092F0CEBDB-205TGG",
          AWASH_CONFIG,
        ),
      { message: "Only HTTPS URLs are allowed." },
    );
  });

  it("should reject unknown domain", () => {
    assert.throws(
      () =>
        validateReceiptUrl(
          "https://evil.com:8225/-E4092F0CEBDB-205TGG",
          AWASH_CONFIG,
        ),
      { message: "Unrecognized receipt domain." },
    );
  });

  it("should reject wrong port", () => {
    assert.throws(
      () =>
        validateReceiptUrl(
          "https://awashpay.awashbank.com:443/-E4092F0CEBDB-205TGG",
          AWASH_CONFIG,
        ),
      { message: "Invalid Awash receipt port. Expected 8225." },
    );
  });

  it("should reject missing token (no /- prefix)", () => {
    assert.throws(
      () =>
        validateReceiptUrl(
          "https://awashpay.awashbank.com:8225/receipt/E4092F0CEBDB",
          AWASH_CONFIG,
        ),
      { message: "Invalid Awash receipt URL format. Expected /-{TOKEN}." },
    );
  });

  it("should reject invalid token format", () => {
    assert.throws(
      () =>
        validateReceiptUrl(
          "https://awashpay.awashbank.com:8225/-abc",
          AWASH_CONFIG,
        ),
      { message: "Invalid Awash receipt token format." },
    );
  });

  it("should reject empty string", () => {
    assert.throws(() => validateReceiptUrl("", AWASH_CONFIG), {
      message: "No URL provided.",
    });
  });

  it("should reject malformed URL", () => {
    assert.throws(() => validateReceiptUrl("not-a-url", AWASH_CONFIG), {
      message: "Invalid URL format.",
    });
  });
});

// ------------------------------------------------------------------
// Parser Tests
// ------------------------------------------------------------------
describe("Awash Parser", () => {
  const parser = new AwashParser();

  // --- extract() ---
  describe("extract()", () => {
    it("should extract link from SMS with full URL", () => {
      const sms =
        "Dear Customer, your transfer of 500 ETB was successful. View receipt: https://awashpay.awashbank.com:8225/-E4092F0CEBDB-205TGG";
      const { link } = parser.extract(sms);
      assert.equal(
        link,
        "https://awashpay.awashbank.com:8225/-E4092F0CEBDB-205TGG",
      );
    });

    it("should extract link from SMS with broken URL spacing", () => {
      const sms =
        "Dear Customer, receipt: https :// awashpay.awashbank.com :8225 / -2KDL95Z0NR-4U61O6";
      const { link } = parser.extract(sms);
      assert.equal(
        link,
        "https://awashpay.awashbank.com:8225/-2KDL95Z0NR-4U61O6",
      );
    });

    it("should extract token fallback when no full URL", () => {
      const text = "Token: 2KDL95Z0NR-4U61O6 for your transfer";
      const { link } = parser.extract(text);
      assert.equal(
        link,
        "https://awashpay.awashbank.com:8225/-2KDL95Z0NR-4U61O6",
      );
    });

    it("should return empty link when no match found", () => {
      const { link } = parser.extract("No receipt info here");
      assert.equal(link, "");
    });
  });

  // --- transactionRef() ---
  describe("transactionRef()", () => {
    it("should build URL from hex transaction ref", () => {
      const { link } = parser.transactionRef("E4092F0CEBDB-205TGG");
      assert.equal(
        link,
        "https://awashpay.awashbank.com:8225/-E4092F0CEBDB-205TGG",
      );
    });

    it("should build URL from base36 transaction ref", () => {
      const { link } = parser.transactionRef("2KDL95Z0NR-4U61O6");
      assert.equal(
        link,
        "https://awashpay.awashbank.com:8225/-2KDL95Z0NR-4U61O6",
      );
    });

    it("should uppercase the ref", () => {
      const { link } = parser.transactionRef("e4092f0cebdB-205tgg");
      assert.equal(
        link,
        "https://awashpay.awashbank.com:8225/-E4092F0CEBDB-205TGG",
      );
    });
  });

  // --- receiptParser() ---
  describe("receiptParser()", () => {
    it("should parse 2025 receipt correctly", async () => {
      const result = await parser.receiptParser(MOCK_RECEIPT_HTML);
      assert.equal(result.bank, "AWASH");
      assert.equal(result.receipt.transactionNumber, "E4092F0CEBDB");
      assert.equal(result.receipt.date, "2025-07-28 09:52:44 AM");
      assert.equal(result.receipt.amount, "500");
      assert.equal(result.receipt.receiverName, "OBSE ASRAT ZEGEYE");
      assert.equal(result.receipt.receiverAccount, "1000303451726");
    });

    it("should parse 2026 receipt with comma-separated amount", async () => {
      const result = await parser.receiptParser(MOCK_RECEIPT_2026_HTML);
      assert.equal(result.bank, "AWASH");
      assert.equal(result.receipt.transactionNumber, "260408174669917");
      assert.equal(result.receipt.date, "2026-04-08 05:47:13 PM");
      assert.equal(result.receipt.amount, "1350"); // commas stripped
      assert.equal(result.receipt.receiverName, "MELKAMU GEMECHU");
      assert.equal(result.receipt.receiverAccount, "1000358356722");
    });

    it("should throw on invalid HTML (missing tables)", async () => {
      await assert.rejects(
        () => parser.receiptParser("<html><body>No tables here</body></html>"),
        { message: /Expected at least 3 info-table/ },
      );
    });

    it("should throw on null input", async () => {
      await assert.rejects(() => parser.receiptParser(null), {
        message: /No HTML data to parse/,
      });
    });
  });
});
