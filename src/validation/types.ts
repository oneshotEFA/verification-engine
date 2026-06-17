export interface UrlValidationConfig {
  domains: string[];
  validate(parsed: URL): void;
}
