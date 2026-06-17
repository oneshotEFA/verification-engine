import { ALLOWED_URLS } from "./allowed-url";

export class CBEBankUrlPipe {
  transform(url: string): string {
    if (!url || typeof url !== "string") {
      throw new Error(
        "⚠️ Invalid input. Please provide a valid CBE receipt link.",
      );
    }
    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      throw new Error(
        "⚠️ Invalid URL format. Please provide a valid CBE receipt link.",
      );
    }
    //  HTTPS only
    if (parsed.protocol !== "https:") {
      throw new Error("⚠️ Only HTTPS links are allowed.");
    }
    const config = ALLOWED_URLS.find(
      (c) => parsed.hostname.toLowerCase() === c.hostname,
    );
    if (!config) {
      throw new Error("⚠️ Unrecognized CBE receipt domain.");
    }
    // Validate port if required
    if (config.port && parsed.port !== config.port) {
      throw new Error("⚠️ Invalid port for this receipt link.");
    }
    // Validate receipt structure
    if (config.type === "query") {
      if (!parsed.searchParams.get("id")) {
        throw new Error("⚠️ Missing receipt ID in query.");
      }
    }
    if (config.type === "path") {
      const receiptCode = parsed.pathname.replace("/", "");
      // basic validation (you can make stricter)
      const isValid = /^[A-Z0-9-]+$/.test(receiptCode);
      if (!receiptCode || !isValid) {
        throw new Error("⚠️ Invalid receipt code in URL path.");
      }
    }
    return parsed.toString();
  }
}
