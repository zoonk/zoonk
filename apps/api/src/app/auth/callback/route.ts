import { trackAuthCompleted } from "@/lib/server-track-events";
import { getAuthError } from "@zoonk/auth/errors";
import { getRouterPayloadFallback } from "@zoonk/core/navigation/document-route";
import { suggestCurrentUsername, updateCurrentUser } from "@zoonk/core/users/current";
import { getSession } from "@zoonk/core/users/session";
import { safeAsync } from "@zoonk/utils/error";
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

/**
 * A new account the provider already named (Google, Apple) gets a username made from its email
 * instead of a screen asking for one; it can change both in its profile. False sends it to the
 * setup screen: no name yet (an email sign-up), or the username was taken in the meantime.
 */
async function nameNewAccount({ name }: { name: string }): Promise<boolean> {
  const username = name ? await suggestCurrentUsername() : null;

  if (!username) {
    return false;
  }

  const { error } = await safeAsync(() => updateCurrentUser({ input: { username } }));

  if (!error) {
    return true;
  }

  if (getAuthError(error)?.code === "USERNAME_IS_ALREADY_TAKEN") {
    return false;
  }

  throw error;
}

function redirectTo(location: string): Response {
  return new Response(null, {
    headers: { "Cache-Control": "no-store", Location: location },
    status: 307,
  });
}

/**
 * Where a finished sign-in goes, answered as redirects before anything renders, so the screen the
 * learner pressed Continue on stays until the app it goes back to opens: the profile setup for a
 * new account without a name, otherwise the app that asked (`redirectTo`) with a one-time token for
 * this session. Opened by the router (the setup's redirect), it runs as a document load instead.
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

  const locale = await getLocale();

  if (!session.user.username || !session.user.name) {
    await trackAuthCompleted({ action: "sign-up", locale, userId: session.user.id });

    if (!(await nameNewAccount({ name: session.user.name }))) {
      return redirectTo(getSetupHref(redirectTarget));
    }
  }

  if (!redirectTarget) {
    return redirectTo(MAIN_APP_LOGIN_URL);
  }

  const handoff = await createOneTimeTokenUrl(redirectTarget);

  if (!handoff.success) {
    return redirectTo(UNTRUSTED_ORIGIN_PATH);
  }

  await trackAuthCompleted({ action: "sign-in", locale, userId: session.user.id });

  return redirectTo(handoff.url);
}
