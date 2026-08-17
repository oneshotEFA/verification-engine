import { UrlValidationConfig } from "../../types";

export const DASHEN_CONFIG: UrlValidationConfig = {
  domains: ["receipt.dashensuperapp.com"],

  validate(parsed) {
    // Path must start with /receipt/
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments[0] !== "receipt" || segments.length !== 2) {
      throw new Error(
        "Invalid Dashen receipt URL format. Expected /receipt/{REFERENCE}.",
      );
    }

    const reference = segments[1];
    // Reference format: 3 digits + 4 letters + 6-10 digits + 2 letters
    // e.g. 641OBTS2518100WH, D31OBTI251720001, 387ETAP2522000WK
    const refPattern = /^[A-Z0-9]{14,20}$/i;
    if (!refPattern.test(reference)) {
      throw new Error("Invalid Dashen receipt reference format.");
    }
  },
};
