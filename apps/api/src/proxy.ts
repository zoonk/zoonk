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
 * Distinguishes token-authenticated native and CLI requests from browser
 * requests that rely on automatically attached cookies.
 */
function hasBearerToken(request: NextRequest): boolean {
  const authorization = request.headers.get("authorization")?.trim();

  if (!authorization) {
    return false;
  }

  const [scheme, token] = authorization.split(/\s+/u, 2);
  return scheme?.toLowerCase() === "bearer" && Boolean(token);
}

/**
 * Identifies unsafe custom API requests whose authentication cookies could
 * otherwise be replayed by another site. Better Auth validates its own routes,
 * while guest requests and explicit bearer clients do not need this guard.
 */
function requiresSameOrigin(request: NextRequest): boolean {
  const pathname = request.nextUrl.pathname;

  const isBetterAuthRoute =
    pathname === BETTER_AUTH_PATH || pathname.startsWith(`${BETTER_AUTH_PATH}/`);

  return (
    !isBetterAuthRoute &&
    !SAFE_METHODS.has(request.method) &&
    request.headers.has("cookie") &&
    !hasBearerToken(request)
  );
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

  // Remaining requests without an origin are guests or explicit bearer clients.
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
