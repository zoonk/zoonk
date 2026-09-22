import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import createMiddleware from "next-intl/middleware";
import { type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const localizedMiddleware = createMiddleware(routing);

const CATALOG_PATH = new RegExp(
  `^/(?:(?:${SUPPORTED_LOCALES.join("|")})/)?b/[^/]+/c/[^/]+(?:/|$)`,
  "u",
);

/**
 * Course editions have their own slugs. UI-language variants of the same slug
 * are not translated editions, so next-intl's automatic alternates do not apply.
 */
export default function proxy(request: NextRequest) {
  const response = localizedMiddleware(request);

  if (CATALOG_PATH.test(request.nextUrl.pathname)) {
    response.headers.delete("link");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|auth/callback|_next|_vercel|\\.well-known/workflow|149e9513-01fa-4fb0-aad4-566afd725d1b/2d206a39-8ed7-437e-a3be-862e0f06eea3|.*\\..*).*)",
    "/((?!api|auth|_next|_vercel)[\\w-]+)?/start/learn/(.+)",
  ],
};
