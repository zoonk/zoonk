import "server-only";
import { auth } from "@zoonk/auth";
import { getAuthError } from "@zoonk/auth/errors";
import { safeAsync } from "@zoonk/utils/error";
import { LOCALE_COOKIE } from "@zoonk/utils/locale";
import { getLocaleFromRequest } from "@zoonk/utils/locale-request";
import { type NextRequest, after } from "next/server";
import { trackLearnerEvents } from "../analytics/track-learner-event";
import { getSafeAppRelativePath } from "./ott-redirect";
import { ONE_TIME_TOKEN_LOGIN_STATE_COOKIE } from "./ott-state";

const AUTH_SUCCESS_REDIRECT = "/";

function getExpiredLoginStateCookie(): string {
  return `${ONE_TIME_TOKEN_LOGIN_STATE_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function redirectTo(location: string): Response {
  const headers = new Headers({ Location: location });
  headers.append("set-cookie", getExpiredLoginStateCookie());

  return new Response(null, { headers, status: 302 });
}

function getSafeNextPath(request: NextRequest): string | null {
  return getSafeAppRelativePath(request.nextUrl.searchParams.get("next"));
}

function getAuthErrorRedirect(request: NextRequest): string {
  const params = new URLSearchParams({ error: "auth" });
  const nextPath = getSafeNextPath(request);

  if (nextPath) {
    params.set("next", nextPath);
  }

  return `/login?${params.toString()}`;
}

function authFailure(request: NextRequest): Response {
  if (request.nextUrl.searchParams.get("error") !== "auth") {
    return redirectTo(getAuthErrorRedirect(request));
  }

  return new Response(null, {
    headers: { "Cache-Control": "no-store", "set-cookie": getExpiredLoginStateCookie() },
    status: 401,
  });
}

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

export async function verifyOneTimeTokenCallback(request: NextRequest): Promise<Response> {
  const state = request.nextUrl.searchParams.get("state");
  const token = request.nextUrl.searchParams.get("token");

  if (!token || !isValidLoginState({ request, state })) {
    return authFailure(request);
  }

  const { data: verified, error } = await safeAsync(() =>
    auth.api.verifyOneTimeToken({ body: { token }, headers: request.headers, returnHeaders: true }),
  );

  if (error) {
    if (getAuthError(error)) {
      return authFailure(request);
    }

    throw error;
  }

  const headers = new Headers({ Location: getSafeNextPath(request) ?? AUTH_SUCCESS_REDIRECT });
  headers.append("set-cookie", getExpiredLoginStateCookie());

  for (const cookie of verified.headers.getSetCookie()) {
    headers.append("set-cookie", cookie);
  }

  const locale = getLocaleFromRequest({
    acceptLanguage: request.headers.get("accept-language"),
    cookieLocale: request.cookies.get(LOCALE_COOKIE)?.value,
  });

  after(() =>
    trackLearnerEvents({
      events: [{ name: "Sign In Completed" }],
      locale,
      userId: verified.response.user.id,
    }),
  );

  return new Response(null, { headers, status: 302 });
}
