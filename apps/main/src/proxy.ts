import { hasSessionCookie } from "@zoonk/auth/cookies";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { getCountryFromAcceptLanguage } from "@zoonk/utils/locale-request";
import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { proxyApiRequest } from "./lib/api-proxy";
import { getCatalogNotFound } from "./lib/catalog-not-found";
import { VISITOR_COUNTRY_COOKIE } from "./lib/visitor-country";

const localizedMiddleware = createMiddleware(routing);
const HOME_PATH = new RegExp(`^/(?:${SUPPORTED_LOCALES.join("|")})?$`, "u");

const CATALOG_PATH = new RegExp(
  `^/(?:(?:${SUPPORTED_LOCALES.join("|")})/)?b/[^/]+/c/[^/]+(?:/|$)`,
  "u",
);

/**
 * Keeps the visitor's country in a cookie the browser reads (`VISITOR_COUNTRY_COOKIE`), set only
 * when it changed: the platform's geo header, else the region of the language the browser prefers.
 * Static pages can't read the request, so the pricing page picks its currency from this.
 */
function keepVisitorCountry({
  request,
  response,
}: {
  request: NextRequest;
  response: NextResponse;
}) {
  const country =
    request.headers.get("x-vercel-ip-country") ??
    getCountryFromAcceptLanguage(request.headers.get("accept-language"));

  if (request.cookies.get(VISITOR_COUNTRY_COOKIE)?.value === country) {
    return;
  }

  response.cookies.set(VISITOR_COUNTRY_COOKIE, country, {
    path: "/",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });
}

/**
 * Course editions have their own slugs. UI-language variants of the same slug
 * are not translated editions, so next-intl's automatic alternates do not apply.
 * Once the language is settled, a course or category that doesn't exist gets a real 404.
 */
export default async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/v1" || request.nextUrl.pathname.startsWith("/v1/")) {
    return proxyApiRequest(request);
  }

  const response = localizedMiddleware(request);
  keepVisitorCountry({ request, response });

  /**
   * Resolve the home page's language before sending a session browser to Today, in one hop and
   * before rendering. The cookie is only a routing hint; Today checks the session itself.
   */
  if (HOME_PATH.test(request.nextUrl.pathname) && hasSessionCookie(request.cookies)) {
    const resolvedUrl = new URL(
      response.headers.get("location") ??
        response.headers.get("x-middleware-rewrite") ??
        request.url,
    );

    const prefix = resolvedUrl.pathname.replace(/\/$/u, "");
    resolvedUrl.pathname = `${prefix === `/${DEFAULT_LOCALE}` ? "" : prefix}/today`;
    const redirect = NextResponse.redirect(resolvedUrl);

    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }

    return redirect;
  }

  if (CATALOG_PATH.test(request.nextUrl.pathname)) {
    response.headers.delete("link");
  }

  if (response.headers.has("location")) {
    return response;
  }

  return (await getCatalogNotFound({ localized: response, request })) ?? response;
}

export const config = {
  matcher: [
    "/v1/:path*",
    "/((?!api|auth/callback|_next|_vercel|\\.well-known/workflow|149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3|.*\\..*).*)",
  ],
};
