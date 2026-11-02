import { getPathname } from "@/i18n/navigation";
import { getBrowserOrigin, startOneTimeTokenLogin } from "@zoonk/core/auth/ott/login-route";
import { getSafeAppRelativePath } from "@zoonk/core/auth/ott/redirect";
import { SUPPORTED_LOCALES, getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { type NextRequest } from "next/server";

/** Only learner-facing pages can be an implicit return target, never auth or API routes. */
const RETURN_PAGE = new RegExp(
  `^/(?:(?:${SUPPORTED_LOCALES.join("|")})(?:/|$))?(?:$|(?:activity|b|blog|buddy|content|courses|energy|exam|learn|level|logbook|mind-maps|mistakes|mock|patterns|plan|pricing|privacy|profile|score|settings|speaking|start|stats|subscription|support|terms|today)(?:/|$))`,
  "u",
);

/** The static shell can't know its page, but the browser sends it as Referer. */
function getReferrerPath(request: NextRequest): string | null {
  const referrer = request.headers.get("referer");

  if (!referrer || !URL.canParse(referrer)) {
    return null;
  }

  const url = new URL(referrer);

  if (url.origin !== new URL(getBrowserOrigin(request)).origin || !RETURN_PAGE.test(url.pathname)) {
    return null;
  }

  return getSafeAppRelativePath(`${url.pathname}${url.search}`);
}

export async function GET(request: NextRequest, { params }: RouteContext<"/[lang]/login">) {
  const { lang } = await params;
  const locale = getSupportedLocaleFromLanguage(lang);
  const { searchParams } = request.nextUrl;

  const nextPath =
    (searchParams.has("next")
      ? getSafeAppRelativePath(searchParams.get("next"))
      : getReferrerPath(request)) ?? getPathname({ href: "/today", locale });

  return startOneTimeTokenLogin({
    callbackPath: `/auth/callback?next=${encodeURIComponent(nextPath)}`,
    expired: searchParams.get("error") === "auth",
    locale,
    request,
  });
}
