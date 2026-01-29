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
 * - Any localhost port (http://localhost:*)
 * - Custom origins from TRUSTED_ORIGINS env var (comma-separated, non-production only)
 */
export function getDevTrustedOrigins(): string[] {
  if (!isE2E && isProduction) {
    return [];
  }

  const customOrigins =
    process.env.TRUSTED_ORIGINS?.split(",").map((origin) => origin.trim()) ?? [];

  return ["http://localhost:*", ...customOrigins];
}

const ZOONK_DOMAINS = [".zoonk.com", ".zoonk.app", ".zoonk.school", ".zoonk.team"];

/**
 * Checks if an origin is trusted for CORS.
 *
 * Allows:
 * - Any subdomain of zoonk.com, zoonk.app, zoonk.school, zoonk.team
 * - localhost (any port)
 * - Vercel preview deployments (*-zoonk.vercel.app) when not in production
 */
export function isTrustedOrigin(origin: string): boolean {
  // Zoonk domains (apex and subdomains)
  for (const domain of ZOONK_DOMAINS) {
    const apex = `https://${domain.slice(1)}`; // E.g., https://zoonk.com
    if (origin === apex || origin.endsWith(domain)) {
      return true;
    }
  }

  // Localhost (any port)
  if (origin.startsWith("http://localhost:")) {
    return true;
  }

  // Vercel preview deployments (not in production)
  if (process.env.VERCEL_ENV !== "production" && origin.endsWith("-zoonk.vercel.app")) {
    return true;
  }

  return false;
}
