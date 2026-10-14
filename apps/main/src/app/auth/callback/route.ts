import { getPathname } from "@/i18n/navigation";
import { getSessionHintCookie } from "@/lib/learner/session-hint";
import { getSessionCookieName } from "@zoonk/auth/cookies";
import { verifyOneTimeTokenCallback } from "@zoonk/core/auth/ott/callback";
import { getSafeAppRelativePath } from "@zoonk/core/auth/ott/redirect";
import { LOCALE_COOKIE } from "@zoonk/utils/locale";
import { getLocaleFromRequest } from "@zoonk/utils/locale-request";
import { getExtracted } from "next-intl/server";
import { type NextRequest } from "next/server";

const AUTH_FAILED_STATUS = 401;

/** HTML delivery stays in the app; translated text and safe query strings are escaped. */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** When a `Set-Cookie` header's cookie ends (`Max-Age` first, then `Expires`); null for neither. */
function getCookieEnd(cookie: string): Date | null {
  const maxAge = /;\s*max-age=(?<seconds>\d+)/iu.exec(cookie)?.groups?.seconds;

  if (maxAge !== undefined) {
    return new Date(Date.now() + Number(maxAge) * 1000);
  }

  const expires = /;\s*expires=(?<date>[^;]+)/iu.exec(cookie)?.groups?.date;
  return expires === undefined ? null : new Date(expires);
}

/** The session cookie a sign-in sets (not one it clears), secure or not. */
function findSessionCookie(cookies: readonly string[]): string | undefined {
  const names = [true, false].map((secure) => getSessionCookieName({ secure }));

  return cookies.find((cookie) =>
    names.some((name) => cookie.startsWith(`${name}=`) && !cookie.startsWith(`${name}=;`)),
  );
}

/**
 * A sign-in that finished sets the session cookie: the browser's session hint (`SESSION_HINT_COOKIE`)
 * goes with it, for as long, so pages without a server render of the learner read their summary.
 */
function withSessionHint({ request, response }: { request: NextRequest; response: Response }) {
  const session = findSessionCookie(response.headers.getSetCookie());
  const expiresAt = session ? getCookieEnd(session) : null;

  if (!expiresAt || expiresAt.getTime() <= Date.now()) {
    return response;
  }

  const headers = new Headers(response.headers);
  const secure = request.nextUrl.protocol === "https:";

  headers.append("Set-Cookie", getSessionHintCookie({ expiresAt, secure }));

  return new Response(response.body, { headers, status: response.status });
}

export async function GET(request: NextRequest) {
  const response = await verifyOneTimeTokenCallback(request);

  if (response.status !== AUTH_FAILED_STATUS) {
    return withSessionHint({ request, response });
  }

  const locale = getLocaleFromRequest({
    acceptLanguage: request.headers.get("accept-language"),
    cookieLocale: request.cookies.get(LOCALE_COOKIE)?.value,
  });

  const t = await getExtracted({ locale });
  const next = getSafeAppRelativePath(request.nextUrl.searchParams.get("next"));
  const loginPath = getPathname({ href: "/login", locale });
  const href = next ? `${loginPath}?${new URLSearchParams({ next })}` : loginPath;
  const title = escapeHtml(t("We couldn't sign you in."));
  const retry = escapeHtml(t("Try again"));
  const body = `<!doctype html><html lang="${escapeHtml(locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head><body><main><h1>${title}</h1><a href="${escapeHtml(href)}">${retry}</a></main></body></html>`;

  response.headers.set("Content-Type", "text/html; charset=utf-8");
  return new Response(body, { headers: response.headers, status: 401 });
}
