export enum ProxyType {
  HTTP_CONNECT = "HTTP_CONNECT",
  SOCKS5 = "SOCKS5",
}

export interface ProxyConfig {
  enabled: boolean;
  url: string | null;
  type: ProxyType;
}

/**
 * Implement this interface in your host application and pass it to
 * BankFetchService. The library never reads a database directly.
 *
 * Example with Prisma:
 *
 *   class MyProxyResolver implements ProxyResolver {
 *     async resolve(countryCode: string) {
 *       const row = await prisma.countryProxy.findUnique({ where: { countryCode } });
 *       if (!row?.proxyEnabled) return null;
 *       return { enabled: true, url: row.proxyUrl, type: row.proxyType as ProxyType };
 *     }
 *   }
 */
export interface ProxyResolver {
  resolve(countryCode: string): Promise<ProxyConfig | null>;
}
