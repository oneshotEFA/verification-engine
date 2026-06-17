import { UrlValidationConfig } from "../../types";

export const CBE_CONFIG: UrlValidationConfig = {
  domains: ["apps.cbe.com.et", "mbreciept.cbe.com.et"],

  validate(parsed) {
    if (parsed.hostname === "apps.cbe.com.et") {
      if (parsed.port !== "100") {
        throw new Error("Invalid CBE receipt port.");
      }

      if (!parsed.searchParams.get("id")) {
        throw new Error("Missing receipt ID.");
      }
    }

    if (parsed.hostname === "mbreciept.cbe.com.et") {
      const receiptCode = parsed.pathname.replace("/", "");

      const isValid = /^[A-Z0-9-]+$/i.test(receiptCode);

      if (!receiptCode || !isValid) {
        throw new Error("Invalid receipt code.");
      }
    }
  },
};
