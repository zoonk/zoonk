import { AUTH_LOCALE_HEADER, getAuthLocale } from "@/i18n/auth-locale";
import { errors } from "@/lib/api-errors";
import { LOCALE_COOKIE } from "@zoonk/utils/locale";
import { isCorsAllowedOrigin } from "@zoonk/utils/origin";
import { type NextRequest, NextResponse } from "next/server";

const corsHeaders = {
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const AUTH_PATH = "/auth";
const BETTER_AUTH_PATH = "/v1/auth";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Keeps central-auth pages outside the API-specific origin guard. Next.js
 * already protects Server Actions, while Portless presents a public browser
 * origin that differs from the internal URL exposed through `request.nextUrl`.
 */
function isAuthPageRequest(request: NextRequest): boolean {
  const pathname = request.nextUrl.pathname;
  return pathname === AUTH_PATH || pathname.startsWith(`${AUTH_PATH}/`);
}

/**
 * Identifies unsafe custom API requests whose authentication cookies could
 * otherwise be replayed by another site. Better Auth validates its own routes,
 * while requests without cookies do not expose cookie auth to cross-site replay.
 */
function requiresSameOrigin(request: NextRequest): boolean {
  const pathname = request.nextUrl.pathname;

  const isBetterAuthRoute =
    pathname === BETTER_AUTH_PATH || pathname.startsWith(`${BETTER_AUTH_PATH}/`);

  return !isBetterAuthRoute && !SAFE_METHODS.has(request.method) && request.headers.has("cookie");
}

/**
 * Passes a validated auth locale to the current render and stores it on the
 * API host so later OTP and provider callback pages keep the same language.
 * Removing the incoming header ensures only this proxy can supply the value.
 */
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

  if (requiresSameOrigin(request) && origin !== request.nextUrl.origin) {
    return errors.forbidden("Same-origin request required");
  }

  // Requests that reach here without an origin use a safe method, guest auth, or cookie-free bearer auth.
  // We rate-limit requests in our Vercel config
  if (!origin) {
    return createPassThroughResponse(request);
  }

  const isAllowed = isCorsAllowedOrigin(origin);

  // Handle preflight (OPTIONS)
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

  // Handle regular requests
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

export const config = {
  // Apply shared CORS to API routes and locale handoff only to central-auth pages.
  matcher: ["/auth/:path*", "/v1/:path*"],
};
