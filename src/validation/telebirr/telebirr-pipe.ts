import { ALLOWED_DOMAINS } from "./allowed-url";

export class TelebirrUrlPipe {
  transform(url: string): string {
    if (!url || typeof url !== "string") {
      throw new Error("⚠️ No URL provided.");
    }

    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      throw new Error(
        "⚠️ Invalid URL format. Please send a valid Telebirr receipt link.",
      );
    }

    // Must be HTTPS
    if (parsed.protocol !== "https:") {
      throw new Error(
        "⚠️ Insecure link. Only HTTPS Telebirr receipt links are accepted.",
      );
    }

    // Must be an allowed Telebirr domain
    const hostname = parsed.hostname.toLowerCase();
    const isAllowed = ALLOWED_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );

    if (!isAllowed) {
      throw new Error(
        "⚠️ Unrecognized receipt domain. Please send the original Telebirr receipt link.",
      );
    }

    // Must contain /receipt/ path segment
    const hasReceiptPath = parsed.pathname
      .split("/")
      .some((p) => p.toLowerCase() === "receipt");

    if (!hasReceiptPath) {
      throw new Error(
        "⚠️ The link does not appear to be a Telebirr receipt. Please check the link and try again.",
      );
    }

    return parsed.toString();
  }
}
