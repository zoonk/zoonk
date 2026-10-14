import "server-only";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { buildAuthLoginUrl } from "@zoonk/utils/origin";
import { getRouterPayloadFallback } from "../navigation/document-route";
import {
  ONE_TIME_TOKEN_LOGIN_STATE_COOKIE,
  ONE_TIME_TOKEN_LOGIN_STATE_MAX_AGE_SECONDS,
  addLoginStateToCallbackUrl,
  createLoginState,
} from "./ott-state";

/** A proxy appends its own value to a forwarded header (`a, b`); the first is the browser's. */
function getFirstHeaderValue({ name, request }: { name: string; request: Request }) {
  return request.headers.get(name)?.split(",")[0]?.trim() || null;
}

/**
 * The origin in the browser's address bar. Behind a proxy (Vercel, or Portless in development) the
 * server is reached at another address, so the forwarded host and protocol say which one the
 * learner is on: the callback has to come back to the origin that holds the state cookie.
 */
function getBrowserOrigin(request: Request): string {
  const url = new URL(request.url);

  const host =
    getFirstHeaderValue({ name: "x-forwarded-host", request }) ?? request.headers.get("host");

  const protocol =
    getFirstHeaderValue({ name: "x-forwarded-proto", request }) ?? url.protocol.replace(":", "");

  return host ? `${protocol}://${host}` : url.origin;
}

/**
 * Scoped to the whole app, not `/login`, so the callback can read it. Scripts never need it, so
 * it's out of their reach.
 */
function getLoginStateCookie({ secure, state }: { secure: boolean; state: string }): string {
  return [
    `${ONE_TIME_TOKEN_LOGIN_STATE_COOKIE}=${state}`,
    `Max-Age=${ONE_TIME_TOKEN_LOGIN_STATE_MAX_AGE_SECONDS}`,
    "Path=/",
    "SameSite=Lax",
    "HttpOnly",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

/**
 * Starts sign-in from an app's `/login` route, before anything renders: it binds a new state to this
 * browser with a cookie and answers with central auth's login page, whose callback comes back to
 * `callbackPath` with that state. `expired` says there that the last sign-in couldn't finish. A
 * `<Link>` to `/login` gets the router's document fallback, so only the page load binds a state.
 */
export function startOneTimeTokenLogin({
  callbackPath,
  expired = false,
  locale,
  request,
}: {
  callbackPath: string;
  expired?: boolean;
  locale: SupportedLocale;
  request: Request;
}): Response {
  const routerFallback = getRouterPayloadFallback(request);

  if (routerFallback) {
    return routerFallback;
  }

  const origin = getBrowserOrigin(request);
  const state = createLoginState();
  const returnUrl = new URL(callbackPath, origin);

  if (expired) {
    returnUrl.searchParams.set("error", "auth");
  }

  const callbackUrl = addLoginStateToCallbackUrl({ callbackUrl: returnUrl.toString(), state });

  const headers = new Headers({
    "Cache-Control": "no-store",
    Location: buildAuthLoginUrl({ callbackUrl, expired, locale }),
  });

  headers.append("set-cookie", getLoginStateCookie({ secure: origin.startsWith("https:"), state }));

  return new Response(null, { headers, status: 307 });
}
