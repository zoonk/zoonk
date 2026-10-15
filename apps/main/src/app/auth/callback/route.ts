import { getPathname } from "@/i18n/navigation";
import {
  getOneTimeTokenCallbackPage,
  getOneTimeTokenFailurePage,
  verifyOneTimeTokenCallback,
} from "@zoonk/core/auth/ott/callback";
import { getSafeAppRelativePath } from "@zoonk/core/auth/ott/redirect";
import { LOCALE_COOKIE } from "@zoonk/utils/locale";
import { getLocaleFromRequest } from "@zoonk/utils/locale-request";
import { getExtracted } from "next-intl/server";
import { type NextRequest } from "next/server";

const AUTH_FAILED_STATUS = 401;

function getRequestLocale(request: NextRequest) {
  return getLocaleFromRequest({
    acceptLanguage: request.headers.get("accept-language"),
    cookieLocale: request.cookies.get(LOCALE_COOKIE)?.value,
  });
}

/** The app's sign-in for the page the learner was going to, which starts with a new token. */
function getLoginHref({ locale, request }: { locale: string; request: NextRequest }) {
  const next = getSafeAppRelativePath(request.nextUrl.searchParams.get("next"));
  const loginPath = getPathname({ href: "/login", locale });

  return next ? `${loginPath}?${new URLSearchParams({ next })}` : loginPath;
}

/**
 * A sign-in the callback couldn't finish twice gets a page saying so, with a way to start again
 * for the same page; any other answer goes out as it is.
 */
async function withFailurePage({
  request,
  response,
}: {
  request: NextRequest;
  response: Response;
}) {
  if (response.status !== AUTH_FAILED_STATUS) {
    return response;
  }

  const locale = getRequestLocale(request);
  const t = await getExtracted({ locale });

  return getOneTimeTokenFailurePage({
    copy: { lang: locale, retry: t("Try again"), title: t("We couldn't sign you in.") },
    href: getLoginHref({ locale, request }),
    response,
  });
}

/** Opening the sign-in link: a page that posts itself, so the link alone signs nobody in. */
export async function GET(request: NextRequest) {
  const locale = getRequestLocale(request);
  const t = await getExtracted({ locale });

  const response = getOneTimeTokenCallbackPage({
    copy: {
      action: t("Continue"),
      lang: locale,
      restart: t("Sign in again"),
      title: t("Signing you in…"),
    },
    request,
    restartHref: getLoginHref({ locale, request }),
  });

  return withFailurePage({ request, response });
}

/**
 * The page's post redeems the token. A finished sign-in's response already holds main's session
 * hint beside its session cookie, naming the learner the token signed in
 * (`@zoonk/auth/session-hint`).
 */
export async function POST(request: NextRequest) {
  return withFailurePage({ request, response: await verifyOneTimeTokenCallback(request) });
}
