import "server-only";
import { auth } from "@zoonk/auth";
import { type NextRequest } from "next/server";
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

  const response = await auth.api.verifyOneTimeToken({
    asResponse: true,
    body: { token },
    headers: request.headers,
  });

  if (!response.ok) {
    return authFailure(request);
  }

  const headers = new Headers({ Location: getSafeNextPath(request) ?? AUTH_SUCCESS_REDIRECT });
  headers.append("set-cookie", getExpiredLoginStateCookie());

  for (const cookie of response.headers.getSetCookie()) {
    headers.append("set-cookie", cookie);
  }

  return new Response(null, { headers, status: 302 });
}
