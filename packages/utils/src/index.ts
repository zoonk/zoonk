export const isProduction = process.env.NODE_ENV === "production";

const localTrustedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3003",
];

const productionTrustedOrigins = [
  "https://appleid.apple.com",
  "https://zoonk.com",
  "https://*.zoonk.com",
  "https://zoonk.vercel.app",
  "https://*-zoonk.vercel.app",
];

export const trustedOrigins = isProduction
  ? productionTrustedOrigins
  : [...localTrustedOrigins, ...productionTrustedOrigins];

const localApiUrl = "http://localhost:3004";
const productionApiUrl = "https://api.zoonk.com";
const defaultApiUrl = isProduction ? productionApiUrl : localApiUrl;

export const apiUrl = process.env.NEXT_PUBLIC_API_URL || defaultApiUrl;

const localCookieDomain = "localhost";
const productionCookieDomain = "zoonk.com";
const defaultCookieDomain = isProduction
  ? productionCookieDomain
  : localCookieDomain;

export const cookieDomain = process.env.COOKIE_DOMAIN || defaultCookieDomain;
