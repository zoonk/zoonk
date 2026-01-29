const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.zoonk.com";

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
 */
export function buildAuthLoginUrl({ callbackUrl }: { callbackUrl: string }): string {
  const authUrl = new URL("/auth/login", API_URL);
  authUrl.searchParams.set("redirectTo", callbackUrl);

  return authUrl.toString();
}

/**
 * Returns the base URL of the API app.
 */
export function getApiUrl(): string {
  return API_URL;
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

/**
 * Matches an origin against a wildcard pattern.
 * Pattern: "https://*-zoonk.vercel.app"
 * Origin:  "https://my-branch-zoonk.vercel.app"
 */
function matchWildcardOrigin(origin: string, pattern: string): boolean {
  const wildcardIndex = pattern.indexOf("*");
  if (wildcardIndex === -1) {
    return origin === pattern;
  }

  const prefix = pattern.slice(0, wildcardIndex);
  const suffix = pattern.slice(wildcardIndex + 1);

  return origin.startsWith(prefix) && origin.endsWith(suffix);
}

const HTTPS_PREFIX = "https://";
const ZOONK_DOMAIN_SUFFIX = ".zoonk.com";
const SUBDOMAIN_PATTERN = /^[a-z0-9-]+$/;

/**
 * Checks if an origin is trusted for CORS.
 * Uses simple string matching (not full URL validation).
 * For security-critical validation, use Better Auth's HTTP endpoint.
 *
 * Handles:
 * - Production: https://zoonk.com, https://*.zoonk.com
 * - Development: localhost:3000-3009 (via getDevTrustedOrigins)
 * - Vercel previews: https://*-zoonk.vercel.app (via getVercelTrustedOrigins)
 */
export function isTrustedOrigin(origin: string): boolean {
  // Exact match: zoonk.com
  if (origin === "https://zoonk.com") {
    return true;
  }

  // Wildcard: *.zoonk.com (simple endsWith check)
  if (origin.startsWith(HTTPS_PREFIX) && origin.endsWith(ZOONK_DOMAIN_SUFFIX)) {
    // Extract subdomain by removing prefix and suffix
    const subdomain = origin.slice(HTTPS_PREFIX.length, -ZOONK_DOMAIN_SUFFIX.length);
    if (SUBDOMAIN_PATTERN.test(subdomain)) {
      return true;
    }
  }

  // Dev/E2E origins: localhost:3000-3009, custom TRUSTED_ORIGINS
  if (getDevTrustedOrigins().includes(origin)) {
    return true;
  }

  // Vercel preview deployments: https://*-zoonk.vercel.app
  const vercelPatterns = getVercelTrustedOrigins();
  for (const pattern of vercelPatterns) {
    if (matchWildcardOrigin(origin, pattern)) {
      return true;
    }
  }

  return false;
}
