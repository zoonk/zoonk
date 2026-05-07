/**
 * Sets a browser cookie through the Cookie Store API when the browser supports
 * it, and falls back to `document.cookie` for older browsers or insecure HTTP
 * contexts. Await this when the next step depends on the cookie being stored
 * before navigation or reload.
 */
export async function setCookie(
  name: string,
  value: string,
  options: {
    expires?: number;
    maxAge?: number;
    path?: string;
    sameSite?: "strict" | "lax" | "none";
  } = {},
): Promise<void> {
  const { expires, maxAge, path = "/", sameSite = "lax" } = options;

  // Cookie Store API is available and we're in a secure context
  if ("cookieStore" in globalThis && globalThis.isSecureContext) {
    const cookieOptions: CookieInit = { name, path, sameSite, value };

    if (maxAge !== undefined) {
      cookieOptions.expires = Date.now() + maxAge * 1000;
    } else if (expires !== undefined) {
      cookieOptions.expires = Date.now() + expires * 24 * 60 * 60 * 1000;
    }

    await globalThis.cookieStore.set(cookieOptions);
    return;
  }

  // Fallback to document.cookie for older browsers or non-HTTPS
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];

  if (maxAge !== undefined) {
    parts.push(`max-age=${maxAge}`);
  } else if (expires !== undefined) {
    parts.push(`max-age=${expires * 24 * 60 * 60}`);
  }

  parts.push(`path=${path}`);
  parts.push(`samesite=${sameSite}`);

  // eslint-disable-next-line unicorn/no-document-cookie -- Fallback for older browsers
  document.cookie = parts.join("; ");
}
