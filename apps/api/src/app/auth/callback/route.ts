import { getBrowserLocale } from "@/i18n/locale";
import { trackSignInCompleted } from "@/lib/server-track-events";
import { getRouterPayloadFallback } from "@zoonk/core/navigation/document-route";
import { getSession } from "@zoonk/core/users/session";
import { MAIN_URL } from "@zoonk/utils/url";
import { type NextRequest } from "next/server";
import {
  getLoginHref,
  getSetupHref,
  getUntrustedOriginHref,
  readRedirectTo,
} from "../_utils/auth-redirect";
import { createOneTimeTokenUrl, isTrustedRedirect } from "./handoff";

const MAIN_APP_LOGIN_URL = new URL("/login", MAIN_URL).toString();

function redirectTo(location: string): Response {
  return new Response(null, {
    headers: { "Cache-Control": "no-store", Location: location },
    status: 307,
  });
}

/**
 * Answers with redirects before anything renders, so the screen the learner pressed Continue on
 * stays until the app it goes back to opens.
 */
export async function GET(request: NextRequest) {
  const routerFallback = getRouterPayloadFallback(request);

  if (routerFallback) {
    return routerFallback;
  }

  const redirectTarget = readRedirectTo(
    request.nextUrl.searchParams.get("redirectTo") ?? undefined,
  );

  const [session, locale] = await Promise.all([getSession(), getBrowserLocale()]);

  if (!session) {
    return redirectTo(getLoginHref({ locale, redirectTo: redirectTarget }));
  }

  if (redirectTarget && !(await isTrustedRedirect(redirectTarget))) {
    return redirectTo(getUntrustedOriginHref(locale));
  }

  if (!session.user.username || !session.user.name) {
    return redirectTo(getSetupHref({ locale, redirectTo: redirectTarget }));
  }

  if (!redirectTarget) {
    return redirectTo(MAIN_APP_LOGIN_URL);
  }

  const handoff = await createOneTimeTokenUrl(redirectTarget);

  if (!handoff.success) {
    return redirectTo(getUntrustedOriginHref(locale));
  }

  await trackSignInCompleted({ locale, userId: session.user.id });

  return redirectTo(handoff.url);
}
