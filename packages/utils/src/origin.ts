import { API_URL } from "./constants";
import { getEnvironment, isLocalhostSupported } from "./environment";

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
 * 1. Uses `NEXT_PUBLIC_APP_DOMAIN` when set (with `http://` for localhost, `https://` otherwise)
 * 2. Falls back to `VERCEL_URL` in Vercel preview environments
 * 3. Throws if neither is available
 *
 * @returns The full base URL including scheme (e.g., "https://zoonk.com" or "http://localhost:3000")
 */
export function getBaseUrl(): string {
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

/**
 * Builds the allowed hosts list for Better Auth's dynamic base URL.
 * Includes zoonk domains, localhost (dev/e2e), and Vercel previews (non-production).
 */
export function getAllowedHosts(): string[] {
  return [
    ...ZOONK_DOMAINS.flatMap((domain) => [domain, `*.${domain}`]),
    ...(isLocalhostSupported() ? ["localhost:*"] : []),
    ...(getEnvironment() === "production" ? [] : ["*-zoonk.vercel.app"]),
  ];
}

/**
 * Checks if an origin is allowed for CORS.
 *
 * Allows:
 * - Any subdomain of zoonk.com, zoonk.dev (https only)
 * - localhost with valid port (dev/e2e only)
 * - Vercel preview deployments (*-zoonk.vercel.app, https only, non-production only)
 */
function isHttpsOriginOf(origin: string, domain: string): boolean {
  return (
    origin === `https://${domain}` ||
    (origin.startsWith("https://") && origin.endsWith(`.${domain}`))
  );
}

export function isCorsAllowedOrigin(origin: string): boolean {
  if (ZOONK_DOMAINS.some((domain) => isHttpsOriginOf(origin, domain))) {
    return true;
  }

  const LOCALHOST_PREFIX = "http://localhost:";
  const port = origin.slice(LOCALHOST_PREFIX.length);
  const isValidLocalhostOrigin = origin.startsWith(LOCALHOST_PREFIX) && /^\d+$/.test(port);

  if (isLocalhostSupported() && isValidLocalhostOrigin) {
    return true;
  }

  // Production servers reject Vercel preview origins to prevent
  // untested preview deployments from making requests to production.
  const isAllowedVercelPreview =
    getEnvironment() !== "production" &&
    origin.startsWith("https://") &&
    origin.endsWith("-zoonk.vercel.app");

  return isAllowedVercelPreview;
}
