import { AllowedConfig } from "../type";

export const ALLOWED_URLS: AllowedConfig[] = [
  {
    hostname: "apps.cbe.com.et",
    port: "100",
    type: "query", // old format
  },
  {
    hostname: "mbreciept.cbe.com.et",
    type: "path", // new format
  },
];
