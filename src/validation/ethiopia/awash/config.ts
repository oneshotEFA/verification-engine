import { UrlValidationConfig } from "../../types";

export const AWASH_CONFIG: UrlValidationConfig = {
  domains: ["awashpay.awashbank.com"],

  validate(parsed) {
    // Awash receipt URLs must use port 8225
    if (parsed.port !== "8225") {
      throw new Error("Invalid Awash receipt port. Expected 8225.");
    }

    // The pathname must start with /- followed by the token
    const pathname = parsed.pathname;
    if (!pathname.startsWith("/-")) {
      throw new Error("Invalid Awash receipt URL format. Expected /-{TOKEN}.");
    }

    const token = pathname.slice(2);
    // Token format: BASE36_TXN_ID-COUNTER (e.g. "2KDL95Z0NR-4U61O6" or "E4092F0CEBDB-205TGG")
    const tokenPattern = /^[A-Za-z0-9]{6,14}-[A-Za-z0-9]{5,6}$/;
    if (!tokenPattern.test(token)) {
      throw new Error("Invalid Awash receipt token format.");
    }
  },
};
