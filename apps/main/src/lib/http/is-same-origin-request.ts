/** The first forwarded value, as Next.js picks it for Server Actions when several proxies append their own. */
function getRequestHost(headers: Headers): string | null {
  const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  return forwardedHost || headers.get("host");
}

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

/** The Origin check Server Actions apply. These routes are browser-only, so a missing Origin is refused too. */
export function isSameOriginRequest(headers: Headers): boolean {
  const originHost = getOriginHost(headers);
  const requestHost = getRequestHost(headers);

  return Boolean(originHost && requestHost && originHost === requestHost);
}
