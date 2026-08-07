import { getEnvironment, isLocalhostSupported } from "./environment";
import { API_URL } from "./url";

/**
 * Determines the appropriate scheme (http/https) for a domain.
 * Uses http for localhost, https for everything else.
 */
function getScheme(domain: string): "http" | "https" {
  return domain.startsWith("localhost") ? "http" : "https";
}

/**
 * Gets the base URL for the current app based on the environment.
 *
 * Uses the following logic:
 * 1. Uses `PORTLESS_URL` during local development
 * 2. Uses `NEXT_PUBLIC_APP_DOMAIN` when set (with `http://` for localhost, `https://` otherwise)
 * 3. Falls back to `VERCEL_URL` in Vercel preview environments
 * 4. Throws if none is available
 *
 * @returns The full base URL including scheme (e.g., "https://zoonk.com" or "http://localhost:3000")
 */
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

/**
 * Builds the login URL for the centralized auth app.
 * @param callbackUrl - The URL to redirect to after successful authentication
 */
export function buildAuthLoginUrl({ callbackUrl }: { callbackUrl: string }): string {
  const authUrl = new URL("/auth/login", API_URL);
  authUrl.searchParams.set("redirectTo", callbackUrl);

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

/**
 * Builds the allowed hosts list for Better Auth's dynamic base URL.
 * Includes zoonk domains, localhost (dev/e2e), and Vercel previews (non-production).
 */
export function getAllowedHosts(): string[] {
  return [
    ...ZOONK_DOMAINS.flatMap((domain) => [domain, `*.${domain}`]),
    ...(isLocalhostSupported() ? LOCAL_DEVELOPMENT_HOSTS : []),
    ...(getEnvironment() === "production" ? [] : ["*-zoonk.vercel.app"]),
  ];
}

/** Rejects paths, credentials, and malformed values before any hostname allowlist is considered. */
function getExactOrigin(origin: string): URL | null {
  try {
    const url = new URL(origin);

    return url.origin === origin ? url : null;
  } catch {
    return null;
  }
}

/** Checks a parsed hostname without allowing suffix lookalikes such as `zoonk.com.evil.com`. */
function isDomainOrSubdomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/** Recognizes the loopback and mDNS hostnames that Portless uses only during local development. */
function isLocalDevelopmentHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local");
}

/** Gives Better Auth the same protocol-qualified local patterns used by the shared host allowlist. */
export function getDevelopmentTrustedOrigins(): string[] {
  if (!isLocalhostSupported()) {
    return [];
  }

  return LOCAL_DEVELOPMENT_HOSTS.flatMap((host) => [`http://${host}`, `https://${host}`]);
}

/**
 * Allows HTTPS Zoonk domains, local Portless or localhost origins during development and E2E, and non-production Vercel previews. Parsing the complete origin prevents suffix and credential lookalikes from bypassing the hostname checks.
 */
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
