import { UrlValidationConfig } from "../../types";

export const ZEMEN_CONFIG: UrlValidationConfig = {
  domains: ["share.zemenbank.com"],

  validate(parsed) {
    // Path must be /rt/{REFERENCE}/pdf
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (
      segments[0] !== "rt" ||
      segments.length !== 3 ||
      segments[2] !== "pdf"
    ) {
      throw new Error(
        "Invalid Zemen receipt URL format. Expected /rt/{REFERENCE}/pdf.",
      );
    }

    const reference = segments[1];
    // Reference: alphanumeric, 8-20 chars
    // e.g. ZM987654321 (11), or numeric invoice references
    if (!/^[A-Z0-9]{8,20}$/i.test(reference)) {
      throw new Error("Invalid Zemen receipt reference format.");
    }
  },
};
