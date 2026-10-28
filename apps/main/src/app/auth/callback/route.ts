import { getPathname } from "@/i18n/navigation";
import { SIGNED_IN_COOKIE } from "@/lib/auth/auth-change";
import { SESSION_HINT, SESSION_HINT_COOKIE } from "@zoonk/auth/session-hint";
import { verifyOneTimeTokenCallback } from "@zoonk/core/auth/ott/callback";
import { getSafeAppRelativePath } from "@zoonk/core/auth/ott/redirect";
import { LOCALE_COOKIE } from "@zoonk/utils/locale";
import { getLocaleFromRequest } from "@zoonk/utils/locale-request";
import { getExtracted } from "next-intl/server";
import { type NextRequest } from "next/server";

const AUTH_FAILED_STATUS = 401;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function GET(request: NextRequest) {
  const response = await verifyOneTimeTokenCallback(request);

  if (response.status !== AUTH_FAILED_STATUS) {
    if (
      response.headers
        .getSetCookie()
        .some((cookie) => cookie.startsWith(`${SESSION_HINT_COOKIE}=${SESSION_HINT};`))
    ) {
      response.headers.append(
        "set-cookie",
        `${SIGNED_IN_COOKIE}=1; Path=/; Max-Age=60; SameSite=Lax`,
      );
    }

    return response;
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
