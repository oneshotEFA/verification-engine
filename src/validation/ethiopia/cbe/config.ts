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
      const pathname = parsed.pathname.replace("/", "");

      if (!pathname) {
        throw new Error("Missing receipt code.");
      }

      // v2 format: v2-{base64url_token} (e.g. v2-hfHCxGkik5jOG1UM9oqH)
      if (pathname.startsWith("v2-")) {
        const token = pathname.slice(3);
        if (!/^[A-Za-z0-9_-]+$/.test(token)) {
          throw new Error("Invalid v2 receipt token.");
        }
        return;
      }

      // Legacy new-format: {FT_REF}-{ACCOUNT_SUFFIX} (e.g. FT26093JCD32-18872366)
      const isValid = /^[A-Z0-9-]+$/i.test(pathname);
      if (!isValid) {
        throw new Error("Invalid receipt code.");
      }
    }
  },
};
