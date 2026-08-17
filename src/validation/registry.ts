import { CBE_CONFIG } from "./ethiopia/cbe/config";
import { TELEBIRR_CONFIG } from "./ethiopia/telebirr/config";
import { EBIRR_CONFIG } from "./ethiopia/ebirr/config";
import { AWASH_CONFIG } from "./ethiopia/awash/config";
import { DASHEN_CONFIG } from "./ethiopia/dashen/config";

export const URL_VALIDATION_REGISTRY = {
  CBE: CBE_CONFIG,
  TELEBIRR: TELEBIRR_CONFIG,
  EBIRR: EBIRR_CONFIG,
  AWASH: AWASH_CONFIG,
  DASHEN: DASHEN_CONFIG,
} as const;
