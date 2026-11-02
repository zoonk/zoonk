import { AUTH_LOCALE_HEADER, getAuthLocale } from "@/i18n/auth-locale";
import { errors } from "@/lib/api-errors";
import { LOCALE_COOKIE } from "@zoonk/utils/locale";
import { isCorsAllowedOrigin } from "@zoonk/utils/origin";
import { API_URL } from "@zoonk/utils/url";
import { type NextRequest, NextResponse } from "next/server";

/** `Date` is exposed so a client times a run's events by the server's clock. */
const corsHeaders = {
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "Date",
  "Access-Control-Max-Age": "86400",
};

const AUTH_PATH = "/auth";
const BETTER_AUTH_PATH = "/v1/auth";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const API_ORIGIN = new URL(API_URL).origin;

/**
 * Next.js already protects Server Actions, and Portless presents a public origin that differs from
 * `request.nextUrl`, so auth pages skip the API's origin guard.
 */
function isAuthPageRequest(request: NextRequest): boolean {
  const pathname = request.nextUrl.pathname;
  return pathname === AUTH_PATH || pathname.startsWith(`${AUTH_PATH}/`);
}

/** Better Auth validates its own routes, and a request without cookies can't be replayed cross-site. */
function requiresSameOrigin(request: NextRequest): boolean {
  const pathname = request.nextUrl.pathname;

  const isBetterAuthRoute =
    pathname === BETTER_AUTH_PATH || pathname.startsWith(`${BETTER_AUTH_PATH}/`);

  return !isBetterAuthRoute && !SAFE_METHODS.has(request.method) && request.headers.has("cookie");
}

/**
 * Behind Portless the reached origin is the internal port, while the main app's server-to-server
 * calls name the public URL.
 */
function isApiOrigin(request: NextRequest, origin: string | null): boolean {
  return origin === request.nextUrl.origin || origin === API_ORIGIN;
}

/** Removing the incoming header ensures only this proxy can supply the locale. */
function createPassThroughResponse(request: NextRequest): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(AUTH_LOCALE_HEADER);

  const locale = getAuthLocale(request);

  if (locale) {
    requestHeaders.set(AUTH_LOCALE_HEADER, locale);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (locale) {
    response.cookies.set(LOCALE_COOKIE, locale, { path: "/", sameSite: "lax" });
  }

  return response;
}

export function proxy(request: NextRequest) {
  if (isAuthPageRequest(request)) {
    return createPassThroughResponse(request);
  }

  const origin = request.headers.get("origin");

  if (requiresSameOrigin(request) && !isApiOrigin(request, origin)) {
    return errors.forbidden("Same-origin request required");
  }

  // Requests that reach here without an origin use a safe method, guest auth, or cookie-free bearer auth.
  if (!origin) {
    return createPassThroughResponse(request);
  }

  const isAllowed = isCorsAllowedOrigin(origin);

  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      headers: {
        ...(isAllowed && { "Access-Control-Allow-Origin": origin }),
        ...corsHeaders,
        Vary: "Origin",
      },
      status: 204,
    });
  }

  const response = createPassThroughResponse(request);
  response.headers.set("Vary", "Origin");

  if (isAllowed) {
    response.headers.set("Access-Control-Allow-Origin", origin);

    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return response;
}

export const config = { matcher: ["/auth/:path*", "/v1/:path*"] };
