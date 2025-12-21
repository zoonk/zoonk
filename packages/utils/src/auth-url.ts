const AUTH_APP_URL =
  process.env.NEXT_PUBLIC_AUTH_APP_URL || "https://auth.zoonk.com";

/**
 * List of trusted domains that are allowed for redirects.
 * Only these domains can be used as redirect targets.
 */
const TRUSTED_DOMAINS = [
  "zoonk.com",
  "auth.zoonk.com",
  "admin.zoonk.com",
  "editor.zoonk.com",
  "localhost",
] as const;

type BuildAuthUrlOptions = {
  callbackUrl: string;
  locale?: string;
};

/**
 * Validates that a URL is safe for redirect by checking against trusted domains.
 * @param url - The URL to validate
 * @returns true if the URL is safe, false otherwise
 */
export function isValidRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;

    // Check if hostname matches any trusted domain
    return TRUSTED_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  } catch {
    // Invalid URL
    return false;
  }
}

/**
 * Sanitizes and validates a redirect URL.
 * Returns null if the URL is not safe.
 * @param url - The URL to sanitize
 * @returns The sanitized URL or null if invalid
 */
export function sanitizeRedirectUrl(url: string | undefined): string | null {
  if (!url) {
    return null;
  }

  // Must be an absolute URL
  if (!(url.startsWith("http://") || url.startsWith("https://"))) {
    return null;
  }

  if (!isValidRedirectUrl(url)) {
    return null;
  }

  return url;
}

/**
 * Builds the login URL for the centralized auth app.
 * @param callbackUrl - The URL to redirect to after successful authentication
 * @param locale - Optional locale for the auth app
 */
export function buildAuthLoginUrl({
  callbackUrl,
  locale,
}: BuildAuthUrlOptions): string {
  // Validate the callback URL before using it
  const sanitizedCallback = sanitizeRedirectUrl(callbackUrl);

  if (!sanitizedCallback) {
    throw new Error(`Invalid callback URL: ${callbackUrl}`);
  }

  const authUrl = new URL("/login", AUTH_APP_URL);
  authUrl.searchParams.set("redirectTo", sanitizedCallback);

  if (locale && locale !== "en") {
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
