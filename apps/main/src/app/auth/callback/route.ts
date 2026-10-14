import { getPathname } from "@/i18n/navigation";
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

export async function GET(request: NextRequest) {
  const response = await verifyOneTimeTokenCallback(request);

  if (response.status !== AUTH_FAILED_STATUS) {
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
