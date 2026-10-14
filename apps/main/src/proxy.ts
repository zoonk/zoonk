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

/** The pricing page once next-intl resolved its language: `/{locale}/pricing`. */
const PRICING_PATH = new RegExp(`^/(?<locale>${SUPPORTED_LOCALES.join("|")})/pricing/?$`, "u");

/**
 * A pricing page's currency variant asked for by its own address. Its page names `/pricing` as
 * canonical with its language alternates, so next-intl's alternates for the variant's address go.
 */
const PRICING_VARIANT_PATH = new RegExp(
  `^/(?:(?:${SUPPORTED_LOCALES.join("|")})/)?pricing/[^/]+/?$`,
  "u",
);

/**
 * Serves the pricing page in the visitor's currency (`getBillingCurrency`) at its one address:
 * a rewrite to the page's static variant for that currency (`pricing/[currency]`), so every
 * variant is cached for everyone billed in it and the response sets no cookie. The default
 * currency is `/pricing` itself. Null for any other page, and for a redirect next-intl decided.
 */
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
    "/((?!api|auth/callback|_next|_vercel|\\.well-known/workflow|149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3|.*\\..*).*)",
  ],
};
