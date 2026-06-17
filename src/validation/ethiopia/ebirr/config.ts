import { UrlValidationConfig } from "../../types";

export const EBIRR_CONFIG: UrlValidationConfig = {
  domains: ["my.ebirr.com"],

  validate(parsed) {
    const hasReceiptPath = parsed.pathname
      .split("/")
      .some((segment) => segment.toLowerCase() === "receipt");

    if (!hasReceiptPath) {
      throw new Error("The link does not appear to be an EBirr receipt.");
    }
  },
};
