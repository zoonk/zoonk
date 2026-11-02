import { hasSessionCookie } from "@zoonk/auth/cookies";
import { DEFAULT_CURRENCY } from "@zoonk/utils/currency";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { proxyApiRequest } from "./lib/api-proxy";
import { getBillingCurrency } from "./lib/billing-currency";
import { getCatalogNotFound } from "./lib/catalog-not-found";

const localizedMiddleware = createMiddleware(routing);
const HOME_PATH = new RegExp(`^/(?:${SUPPORTED_LOCALES.join("|")})?$`, "u");

const CATALOG_PATH = new RegExp(
  `^/(?:(?:${SUPPORTED_LOCALES.join("|")})/)?b/[^/]+/c/[^/]+(?:/|$)`,
  "u",
);

/**
 * next-intl's middleware would save the language whenever a page opens in another one; only
 * `rememberLocale` may. It's the only cookie the middleware sets, so its cookie headers go.
 */
function dropLocaleCookie(response: NextResponse) {
  response.headers.delete("set-cookie");
  response.headers.delete("x-middleware-set-cookie");
}

const PRICING_PATH = new RegExp(`^/(?<locale>${SUPPORTED_LOCALES.join("|")})/pricing/?$`, "u");

/** The variant names `/pricing` as canonical with its own alternates, so next-intl's for its address go. */
const PRICING_VARIANT_PATH = new RegExp(
  `^/(?:(?:${SUPPORTED_LOCALES.join("|")})/)?pricing/[^/]+/?$`,
  "u",
);

/** A rewrite to a static variant per currency, so each is cached for everyone billed in it and no cookie is set. */
function getPricingRewrite({
  request,
  response,
}: {
  request: NextRequest;
  response: NextResponse;
}): NextResponse | null {
  if (response.headers.has("location")) {
    return null;
  }

  const resolvedUrl = new URL(response.headers.get("x-middleware-rewrite") ?? request.url);
  const locale = PRICING_PATH.exec(resolvedUrl.pathname)?.groups?.locale;
  const currency = getBillingCurrency(request.headers);

  if (!locale || currency === DEFAULT_CURRENCY) {
    return null;
  }

  resolvedUrl.pathname = `/${locale}/pricing/${currency}`;

  const headers = new Headers(response.headers);
  headers.delete("x-middleware-next");

  return NextResponse.rewrite(resolvedUrl, { headers });
}

/** UI-language variants of a course slug aren't translated editions, so next-intl's automatic alternates don't apply. */
export default async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/v1" || request.nextUrl.pathname.startsWith("/v1/")) {
    return proxyApiRequest(request);
  }

  const response = localizedMiddleware(request);
  dropLocaleCookie(response);

  // The cookie is only a routing hint; Today checks the session itself.
  if (HOME_PATH.test(request.nextUrl.pathname) && hasSessionCookie(request.cookies)) {
    const resolvedUrl = new URL(
      response.headers.get("location") ??
        response.headers.get("x-middleware-rewrite") ??
        request.url,
    );

    const prefix = resolvedUrl.pathname.replace(/\/$/u, "");
    resolvedUrl.pathname = `${prefix === `/${DEFAULT_LOCALE}` ? "" : prefix}/today`;
    return NextResponse.redirect(resolvedUrl);
  }

  if (
    CATALOG_PATH.test(request.nextUrl.pathname) ||
    PRICING_VARIANT_PATH.test(request.nextUrl.pathname)
  ) {
    response.headers.delete("link");
  }

  if (response.headers.has("location")) {
    return response;
  }

  return (
    getPricingRewrite({ request, response }) ??
    (await getCatalogNotFound({ localized: response, request })) ??
    response
  );
}

export const config = {
  matcher: [
    "/v1/:path*",
    "/((?!api|auth/apple|auth/callback|_next|_vercel|\\.well-known/workflow|149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3|.*\\..*).*)",
  ],
};
