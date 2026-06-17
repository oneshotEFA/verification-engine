import { UrlValidationConfig } from "./types";

export function validateReceiptUrl(
  url: string,
  config: UrlValidationConfig,
): string {
  if (!url || typeof url !== "string") {
    throw new Error("No URL provided.");
  }

  let parsed: URL;

  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error("Invalid URL format.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Only HTTPS URLs are allowed.");
  }

  const hostname = parsed.hostname.toLowerCase();

  const isAllowed = config.domains.some(
    (domain) =>
      hostname === domain.toLowerCase() ||
      hostname.endsWith(`.${domain.toLowerCase()}`),
  );

  if (!isAllowed) {
    throw new Error("Unrecognized receipt domain.");
  }

  config.validate(parsed);

  return parsed.toString();
}
