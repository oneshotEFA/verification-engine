export type AllowedConfig = {
  hostname: string;
  port?: string;
  type: "query" | "path";
};
export interface BankUrlValidator {
  transform(url: string): string;
}