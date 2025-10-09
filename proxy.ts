import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

export function proxy(request: NextRequest) {
  const handleI18nRouting = createMiddleware(routing);
  const response = handleI18nRouting(request);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * - if they start with `/api`, `/_next` or `/_vercel`
     * - the ones containing a dot (e.g. `favicon.ico`)
     */
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
