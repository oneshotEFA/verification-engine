import { BankUrlValidator } from "./type";
import { CBEBankUrlPipe } from "./cbe/cbe-pipe";

export const BANK_URL_PIPE_REGISTRY: Record<string, BankUrlValidator> = {
  CBE: new CBEBankUrlPipe(),
};
