import { DEFAULT_LOCALE } from "./locale";

const AUTH_APP_URL = process.env.NEXT_PUBLIC_AUTH_APP_URL || "https://auth.zoonk.com";

const isProduction = process.env.NODE_ENV === "production";
const isE2E = process.env.E2E_TESTING === "true";
const repoOwner = process.env.GIT_REPO_OWNER || "zoonk";
const isRepoOwner = process.env.VERCEL_GIT_REPO_OWNER === repoOwner;

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
 * 1. For localhost domains, uses `http://` scheme
 * 2. In Vercel preview environments, uses `VERCEL_URL` with `https://`
 * 3. Otherwise, uses `NEXT_PUBLIC_APP_DOMAIN` with `https://`
 *
 * @returns The full base URL including scheme (e.g., "https://zoonk.com" or "http://localhost:3000")
 */
export function getBaseUrl(): string {
  // In Vercel preview deployments, use the deployment URL
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  const domain = process.env.NEXT_PUBLIC_APP_DOMAIN;

  if (!domain) {
    throw new Error(
      "NEXT_PUBLIC_APP_DOMAIN environment variable is not set. " +
        "Please set it to your app domain (e.g., 'zoonk.com' or 'localhost:3000').",
    );
  }

  return `${getScheme(domain)}://${domain}`;
}

/**
 * Builds the login URL for the centralized auth app.
 * @param callbackUrl - The URL to redirect to after successful authentication
 * @param locale - Optional locale for the auth app
 */
export function buildAuthLoginUrl({
  callbackUrl,
  locale,
}: {
  callbackUrl: string;
  locale?: string;
}): string {
  const authUrl = new URL("/login", AUTH_APP_URL);
  authUrl.searchParams.set("redirectTo", callbackUrl);

  if (locale && locale !== DEFAULT_LOCALE) {
    // Prepend locale to path for non-default locales
    authUrl.pathname = `/${locale}/login`;
  }

  return authUrl.toString();
}

/**
 * Returns the base URL of the auth app.
 */
export function getAuthAppUrl(): string {
  return AUTH_APP_URL;
}

/**
 * Returns trusted origins for Vercel preview deployments.
 */
export function getVercelTrustedOrigins(): string[] {
  if (isRepoOwner) {
    return [`https://*-${repoOwner}.vercel.app`];
  }

  return [];
}

/**
 * Returns trusted origins for development/testing environments.
 *
 * Includes:
 * - Localhost ports 3000-3009 when E2E_TESTING=true
 * - Custom origins from TRUSTED_ORIGINS env var (comma-separated, non-production only)
 */
const LOCALHOST_PORT_START = 3000;

export function getDevTrustedOrigins(): string[] {
  if (!isE2E && isProduction) {
    return [];
  }

  const localhostOrigins = Array.from(
    { length: 10 },
    (_, i) => `http://localhost:${LOCALHOST_PORT_START + i}`,
  );

  const customOrigins =
    process.env.TRUSTED_ORIGINS?.split(",").map((origin) => origin.trim()) ?? [];

  return [...localhostOrigins, ...customOrigins];
}
