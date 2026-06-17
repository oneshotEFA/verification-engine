import { CBE_CONFIG } from "./ethiopia/cbe/config";
import { TELEBIRR_CONFIG } from "./ethiopia/telebirr/config";
import { EBIRR_CONFIG } from "./ethiopia/ebirr/config";

export const URL_VALIDATION_REGISTRY = {
  CBE: CBE_CONFIG,
  TELEBIRR: TELEBIRR_CONFIG,
  EBIRR: EBIRR_CONFIG,
} as const;
