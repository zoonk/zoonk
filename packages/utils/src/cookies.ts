/** Await this when the next step depends on the cookie being stored before navigation or reload. */
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

  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];

  if (maxAge !== undefined) {
    parts.push(`max-age=${maxAge}`);
  } else if (expires !== undefined) {
    parts.push(`max-age=${expires * 24 * 60 * 60}`);
  }

  parts.push(`path=${path}`, `samesite=${sameSite}`);

  // eslint-disable-next-line unicorn/no-document-cookie -- Fallback for older browsers
  document.cookie = parts.join("; ");
}

function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Reads `document.cookie`, so never an httpOnly cookie. */
export function readCookie(name: string): string | null {
  const prefix = `${encodeURIComponent(name)}=`;
  const entry = document.cookie.split(/;\s*/u).find((cookie) => cookie.startsWith(prefix));

  return entry === undefined ? null : decodeCookieValue(entry.slice(prefix.length));
}
