import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
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

const LEGACY_LEARN_PATH = new RegExp(
  `^/(?:(?:${SUPPORTED_LOCALES.join("|")})/)?start/learn/(.+)$`,
  "u",
);

/** Recover old bookmarks before dynamic route matching decodes their private text again. */
function redirectLegacyLearningRequest({
  request,
  response,
}: {
  request: NextRequest;
  response: NextResponse;
}) {
  const encodedPrompt = LEGACY_LEARN_PATH.exec(request.nextUrl.pathname)?.[1];

  if (!encodedPrompt) {
    return response;
  }

  const localizedUrl = new URL(
    response.headers.get("location") ?? response.headers.get("x-middleware-rewrite") ?? request.url,
  );

  const destination = request.nextUrl.clone();
  destination.pathname = localizedUrl.pathname.replace(/\/start\/learn\/.+$/u, "/start/learn");

  if (destination.pathname.startsWith(`/${routing.defaultLocale}/`)) {
    destination.pathname = destination.pathname.slice(routing.defaultLocale.length + 1);
  }

  /** Fragments stay in the browser; the form consumes this once and clears it from history. */
  destination.hash = `request=${encodedPrompt}`;

  const redirect = NextResponse.redirect(destination, {
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });

  for (const cookie of response.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }

  return redirect;
}

/**
 * Catalog canonicals identify an edition through the URL, including unprefixed
 * English URLs. Opening one must not rewrite the visitor's saved preference or
 * advertise the same course slug as an alternate in every UI language.
 */
export default function proxy(request: NextRequest) {
  const response = CATALOG_PATH.test(request.nextUrl.pathname)
    ? catalogMiddleware(request)
    : localizedMiddleware(request);

  return redirectLegacyLearningRequest({ request, response });
}

export const config = {
  matcher: [
    "/((?!api|auth/callback|_next|_vercel|\\.well-known/workflow|149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3|.*\\..*).*)",
    "/((?!api|auth|_next|_vercel)[\\w-]+)?/start/learn/(.+)",
  ],
};
