/**
 * Sets a cookie using the Cookie Store API with fallback to document.cookie.
 * Cookie Store API requires HTTPS (except localhost), so we fall back for HTTP.
 */
export function setCookie(
  name: string,
  value: string,
  options: {
    expires?: number;
    maxAge?: number;
    sameSite?: "strict" | "lax" | "none";
  } = {},
): void {
  const { expires, maxAge, sameSite = "lax" } = options;

  // Cookie Store API is available and we're in a secure context
  if ("cookieStore" in globalThis && globalThis.isSecureContext) {
    const cookieOptions: CookieInit = { name, sameSite, value };

    if (maxAge !== undefined) {
      cookieOptions.expires = Date.now() + maxAge * 1000;
    } else if (expires !== undefined) {
      cookieOptions.expires = Date.now() + expires * 24 * 60 * 60 * 1000;
    }

    void globalThis.cookieStore.set(cookieOptions);
    return;
  }

  // Fallback to document.cookie for older browsers or non-HTTPS
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];

  if (maxAge !== undefined) {
    parts.push(`max-age=${maxAge}`);
  } else if (expires !== undefined) {
    parts.push(`max-age=${expires * 24 * 60 * 60}`);
  }

  parts.push(`path=/`);
  parts.push(`samesite=${sameSite}`);

  // eslint-disable-next-line unicorn/no-document-cookie -- Fallback for older browsers
  document.cookie = parts.join("; ");
}
