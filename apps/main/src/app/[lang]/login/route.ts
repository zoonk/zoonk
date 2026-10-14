import { getPathname } from "@/i18n/navigation";
import { startOneTimeTokenLogin } from "@zoonk/core/auth/ott/login-route";
import { getSafeAppRelativePath } from "@zoonk/core/auth/ott/redirect";
import { getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { type NextRequest } from "next/server";

/**
 * "Log in" goes straight to the sign-in form: this answers with central auth's login page before
 * anything renders, so there's no screen of its own between them. Sign-in comes back to `next`
 * (an app path) or to Today, and a sign-in the callback couldn't finish (`error=auth`) starts again
 * with a word about it.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/[lang]/login">) {
  const { lang } = await params;
  const locale = getSupportedLocaleFromLanguage(lang);
  const { searchParams } = request.nextUrl;

  const nextPath =
    getSafeAppRelativePath(searchParams.get("next")) ?? getPathname({ href: "/today", locale });

  return startOneTimeTokenLogin({
    callbackPath: `/auth/callback?next=${encodeURIComponent(nextPath)}`,
    expired: searchParams.get("error") === "auth",
    locale,
    request,
  });
}
