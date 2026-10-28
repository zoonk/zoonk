import { getEnvironment, isLocalhostSupported } from "./environment";
import { type SupportedLocale } from "./locale";
import { API_URL } from "./url";

function getScheme(domain: string): "http" | "https" {
  return domain.startsWith("localhost") ? "http" : "https";
}

/** Throws when no base URL is configured. */
export function getBaseUrl(): string {
  if (isLocalhostSupported() && process.env.PORTLESS_URL) {
    return process.env.PORTLESS_URL;
  }

  const domain = process.env.NEXT_PUBLIC_APP_DOMAIN;

  if (domain) {
    return `${getScheme(domain)}://${domain}`;
  }

  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  throw new Error(
    "NEXT_PUBLIC_APP_DOMAIN environment variable is not set. " +
      "Please set it to your app domain (e.g., 'zoonk.com' or 'localhost:3000').",
  );
}

export const AUTH_LOGIN_EXPIRED_ERROR = "expired";

export function buildAuthLoginUrl({
  callbackUrl,
  expired = false,
  locale,
}: {
  callbackUrl: string;
  expired?: boolean;
  locale: SupportedLocale;
}): string {
  const authUrl = new URL("/auth/login", API_URL);
  authUrl.searchParams.set("locale", locale);
  authUrl.searchParams.set("redirectTo", callbackUrl);

  if (expired) {
    authUrl.searchParams.set("error", AUTH_LOGIN_EXPIRED_ERROR);
  }

  return authUrl.toString();
}

const ZOONK_DOMAINS = ["zoonk.com", "zoonk.dev"];

const LOCAL_DEVELOPMENT_HOSTS = [
  "localhost:*",
  "*.localhost",
  "*.localhost:*",
  "*.local",
  "*.local:*",
];

export function getAllowedHosts(): string[] {
  return [
    ...ZOONK_DOMAINS.flatMap((domain) => [domain, `*.${domain}`]),
    ...(isLocalhostSupported() ? LOCAL_DEVELOPMENT_HOSTS : []),
    ...(getEnvironment() === "production" ? [] : ["*-zoonk.vercel.app"]),
  ];
}

function getExactOrigin(origin: string): URL | null {
  try {
    const url = new URL(origin);

    return url.origin === origin ? url : null;
  } catch {
    return null;
  }
}

function isDomainOrSubdomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function isLocalDevelopmentHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local");
}

export function getDevelopmentTrustedOrigins(): string[] {
  if (!isLocalhostSupported()) {
    return [];
  }

  return LOCAL_DEVELOPMENT_HOSTS.flatMap((host) => [`http://${host}`, `https://${host}`]);
}

export function isCorsAllowedOrigin(origin: string): boolean {
  const url = getExactOrigin(origin);

  if (!url) {
    return false;
  }

  if (
    url.protocol === "https:" &&
    ZOONK_DOMAINS.some((domain) => isDomainOrSubdomain(url.hostname, domain))
  ) {
    return true;
  }

  const isLocalProtocol = url.protocol === "http:" || url.protocol === "https:";
  const hasRequiredLocalhostPort = url.hostname !== "localhost" || Boolean(url.port);

  if (
    isLocalhostSupported() &&
    isLocalProtocol &&
    hasRequiredLocalhostPort &&
    isLocalDevelopmentHostname(url.hostname)
  ) {
    return true;
  }

  // Production servers reject Vercel preview origins to prevent
  // untested preview deployments from making requests to production.
  const isAllowedVercelPreview =
    getEnvironment() !== "production" &&
    url.protocol === "https:" &&
    url.hostname.endsWith("-zoonk.vercel.app");

  return isAllowedVercelPreview;
}
