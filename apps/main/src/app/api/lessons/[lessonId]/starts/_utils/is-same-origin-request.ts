/**
 * Resolves the public host selected by the trusted deployment proxy. The first
 * forwarded value matches the host-selection behavior that protects Next
 * Server Actions when multiple proxies append their own values.
 */
function getRequestHost(headers: Headers): string | null {
  const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  return forwardedHost || headers.get("host");
}

/**
 * Parses the browser-controlled Origin header without letting malformed input
 * turn an authorization rejection into a server error.
 */
function getOriginHost(headers: Headers): string | null {
  const origin = headers.get("origin");

  if (!origin || origin === "null") {
    return null;
  }

  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}

/**
 * Recreates the Origin-to-host check that Server Actions apply automatically.
 * This internal cookie-authenticated POST is browser-only, so missing Origins
 * are rejected as well as explicit cross-origin requests.
 */
export function isSameOriginRequest(headers: Headers): boolean {
  const originHost = getOriginHost(headers);
  const requestHost = getRequestHost(headers);

  return Boolean(originHost && requestHost && originHost === requestHost);
}
