import { UrlValidationConfig } from "../../types";


export const TELEBIRR_CONFIG: UrlValidationConfig = {
  domains: ["transactioninfo.ethiotelecom.et"],

  validate(parsed) {
    const hasReceiptPath = parsed.pathname
      .split("/")
      .some((segment) => segment.toLowerCase() === "receipt");

    if (!hasReceiptPath) {
      throw new Error("The link does not appear to be a Telebirr receipt.");
    }
  },
};
