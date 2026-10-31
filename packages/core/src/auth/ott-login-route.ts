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

function getFirstHeaderValue({ name, request }: { name: string; request: Request }) {
  return request.headers.get(name)?.split(",")[0]?.trim() || null;
}

/** Forwarded headers identify the browser origin behind proxies; the callback must return to its state cookie. */
export function getBrowserOrigin(request: Request): string {
  const url = new URL(request.url);

  const host =
    getFirstHeaderValue({ name: "x-forwarded-host", request }) ?? request.headers.get("host");

  const protocol =
    getFirstHeaderValue({ name: "x-forwarded-proto", request }) ?? url.protocol.replace(":", "");

  return host ? `${protocol}://${host}` : url.origin;
}

/** The callback needs the cookie outside `/login`; scripts never need access. */
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

/** A route-based login binds state only on a document navigation, including a Link's document fallback. */
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
