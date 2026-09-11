import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import createMiddleware from "next-intl/middleware";
import { type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const localizedMiddleware = createMiddleware(routing);

const catalogMiddleware = createMiddleware({
  ...routing,
  alternateLinks: false,
  localeCookie: false,
  localeDetection: false,
});

const CATALOG_PATH = new RegExp(
  `^/(?:(?:${SUPPORTED_LOCALES.join("|")})/)?b/[^/]+/c/[^/]+(?:/|$)`,
  "u",
);

/**
 * Catalog canonicals identify an edition through the URL, including unprefixed
 * English URLs. Opening one must not rewrite the visitor's saved preference or
 * advertise the same course slug as an alternate in every UI language.
 */
export default function proxy(request: NextRequest) {
  return CATALOG_PATH.test(request.nextUrl.pathname)
    ? catalogMiddleware(request)
    : localizedMiddleware(request);
}

export const config = {
  matcher: [
    "/((?!api|auth/callback|_next|_vercel|\\.well-known/workflow|149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3|.*\\..*).*)",
    "/((?!api|auth|_next|_vercel)[\\w-]+)?/start/learn/(.+)",
  ],
};
