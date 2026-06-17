import { BankUrlValidator } from "./type";
import { CBEBankUrlPipe } from "./cbe/cbe-pipe";
import { TelebirrUrlPipe } from "./telebirr/telebirr-pipe";

export const BANK_URL_PIPE_REGISTRY: Record<string, BankUrlValidator> = {
  CBE: new CBEBankUrlPipe(),
  TELEBIRR: new TelebirrUrlPipe(),
};
