export function getCrossSubDomainCookies():
  | {
      enabled: boolean;
      domain: string;
    }
  | undefined {
  if (process.env.VERCEL_ENV === "production" && process.env.BETTER_AUTH_COOKIE_DOMAIN) {
    return {
      domain: process.env.BETTER_AUTH_COOKIE_DOMAIN,
      enabled: true,
    };
  }

  return undefined;
}
