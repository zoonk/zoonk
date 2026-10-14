import { trackSignInCompleted } from "@/lib/server-track-events";
import { getRouterPayloadFallback } from "@zoonk/core/navigation/document-route";
import { getSession } from "@zoonk/core/users/session";
import { MAIN_URL } from "@zoonk/utils/url";
import { getLocale } from "next-intl/server";
import { type NextRequest } from "next/server";
import { getLoginHref, getSetupHref, readRedirectTo } from "../_utils/auth-redirect";
import { createOneTimeTokenUrl, isTrustedRedirect } from "./handoff";

/**
 * A sign-in that started on the API itself (no app asked for it) ends in the main app. Its login
 * hands the session over the usual way: it comes back here with its own address, and this session
 * goes straight through.
 */
const MAIN_APP_LOGIN_URL = new URL("/login", MAIN_URL).toString();

const UNTRUSTED_ORIGIN_PATH = "/auth/untrusted-origin";

function redirectTo(location: string): Response {
  return new Response(null, {
    headers: { "Cache-Control": "no-store", Location: location },
    status: 307,
  });
}

/**
 * Where a finished sign-in goes, answered as redirects before anything renders, so the screen the
 * learner pressed Continue on stays until the app it goes back to opens: the profile setup for an
 * account without a name or username, otherwise the app that asked (`redirectTo`) with a one-time
 * token for this session. Opened by the router (the setup's redirect), it runs as a document load
 * instead. A GET writes nothing of the account's: Google and Apple accounts get their username as
 * they're created, the setup saves the rest, and "Sign Up Completed" goes out when the account is
 * created, so opening this again only hands the session over again.
 */
export async function GET(request: NextRequest) {
  const routerFallback = getRouterPayloadFallback(request);

  if (routerFallback) {
    return routerFallback;
  }

  const redirectTarget = readRedirectTo(
    request.nextUrl.searchParams.get("redirectTo") ?? undefined,
  );

  const session = await getSession();

  if (!session) {
    return redirectTo(getLoginHref(redirectTarget));
  }

  if (redirectTarget && !(await isTrustedRedirect(redirectTarget))) {
    return redirectTo(UNTRUSTED_ORIGIN_PATH);
  }

  if (!session.user.username || !session.user.name) {
    return redirectTo(getSetupHref(redirectTarget));
  }

  if (!redirectTarget) {
    return redirectTo(MAIN_APP_LOGIN_URL);
  }

  const handoff = await createOneTimeTokenUrl(redirectTarget);

  if (!handoff.success) {
    return redirectTo(UNTRUSTED_ORIGIN_PATH);
  }

  await trackSignInCompleted({ locale: await getLocale(), userId: session.user.id });

  return redirectTo(handoff.url);
}
