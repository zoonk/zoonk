import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { getCatalogNotFound } from "./lib/catalog-not-found";
import { getSessionRedirect } from "./lib/session-redirects";

const localizedMiddleware = createMiddleware(routing);

const CATALOG_PATH = new RegExp(
  `^/(?:(?:${SUPPORTED_LOCALES.join("|")})/)?b/[^/]+/c/[^/]+(?:/|$)`,
  "u",
);

/**
 * Learners with an account skip the visitor home page, anyone with a session skips pricing, and
 * visitors skip the app's subscription page, all before the page renders.
 * Course editions have their own slugs. UI-language variants of the same slug
 * are not translated editions, so next-intl's automatic alternates do not apply.
 * Once the language is settled, a course or category that doesn't exist gets a real 404.
 */
export default async function proxy(request: NextRequest) {
  const sessionRedirect = getSessionRedirect(request);

  if (sessionRedirect) {
    return NextResponse.redirect(sessionRedirect);
  }

  const response = localizedMiddleware(request);

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
    "/((?!api|auth/callback|_next|_vercel|\\.well-known/workflow|149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3|.*\\..*).*)",
  ],
};
