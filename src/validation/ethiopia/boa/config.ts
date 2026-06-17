import { UrlValidationConfig } from "../../types";

export const BOA_CONFIG: UrlValidationConfig = {
  domains: ["cs.bankofabyssinia.com"],
  validate(parsed) {
    const hasReceiptPath = parsed.pathname
      .split("/")
      .some((segment) => segment.toLowerCase() === "receipt");

    if (!hasReceiptPath) {
      throw new Error("The link does not appear to be a BOA receipt.");
    }
  },
};
