import "server-only";
import { type NextRequest } from "next/server";
import { auth } from "./auth";
import { ONE_TIME_TOKEN_LOGIN_STATE_COOKIE } from "./ott-state";

const AUTH_ERROR_REDIRECT = "/login?error=auth";
const AUTH_SUCCESS_REDIRECT = "/";

/**
 * Expires the state cookie after every callback attempt so a login initiation
 * can only authorize one callback navigation.
 */
function getExpiredLoginStateCookie(): string {
  return `${ONE_TIME_TOKEN_LOGIN_STATE_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}

/**
 * Builds the redirect response used by callback routes so success and failure
 * paths return the same minimal 302 shape in every app that consumes this
 * helper.
 */
function redirectTo(location: string): Response {
  const headers = new Headers({ Location: location });
  headers.append("set-cookie", getExpiredLoginStateCookie());

  return new Response(null, { headers, status: 302 });
}

/**
 * Returns the post-login destination requested by the app login page. Only
 * app-relative paths are allowed here so a valid one-time token cannot become
 * an open redirect to another origin.
 */
function getSafeSuccessRedirect(request: NextRequest): string {
  const nextPath = request.nextUrl.searchParams.get("next");

  if (!nextPath) {
    return AUTH_SUCCESS_REDIRECT;
  }

  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return AUTH_SUCCESS_REDIRECT;
  }

  return nextPath;
}

/**
 * Checks the callback state before the one-time token is redeemed so attacker
 * tokens cannot force a browser into an attacker-controlled session.
 */
function isValidLoginState({
  request,
  state,
}: {
  request: NextRequest;
  state: string | null;
}): boolean {
  if (!state) {
    return false;
  }

  return request.cookies.get(ONE_TIME_TOKEN_LOGIN_STATE_COOKIE)?.value === state;
}

/**
 * Keeps cross-app one-time-token callbacks consistent across apps that receive
 * a Better Auth session handoff. The token is read from the query string so the
 * callback URL stays stable while the state cookie blocks login CSRF.
 */
export async function verifyOneTimeTokenCallback(request: NextRequest): Promise<Response> {
  const state = request.nextUrl.searchParams.get("state");
  const token = request.nextUrl.searchParams.get("token");

  if (!token || !isValidLoginState({ request, state })) {
    return redirectTo(AUTH_ERROR_REDIRECT);
  }

  const response = await auth.api.verifyOneTimeToken({
    asResponse: true,
    body: { token },
    headers: request.headers,
  });

  if (!response.ok) {
    return redirectTo(AUTH_ERROR_REDIRECT);
  }

  const headers = new Headers({ Location: getSafeSuccessRedirect(request) });
  headers.append("set-cookie", getExpiredLoginStateCookie());

  for (const cookie of response.headers.getSetCookie()) {
    headers.append("set-cookie", cookie);
  }

  return new Response(null, { headers, status: 302 });
}
