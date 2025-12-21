const AUTH_APP_URL =
  process.env.NEXT_PUBLIC_AUTH_APP_URL || "https://auth.zoonk.com";

type BuildAuthUrlOptions = {
  callbackUrl: string;
  locale?: string;
};

/**
 * Builds the login URL for the centralized auth app.
 * @param callbackUrl - The URL to redirect to after successful authentication
 * @param locale - Optional locale for the auth app
 */
export function buildAuthLoginUrl({
  callbackUrl,
  locale,
}: BuildAuthUrlOptions): string {
  const authUrl = new URL("/login", AUTH_APP_URL);
  authUrl.searchParams.set("redirectTo", callbackUrl);

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
