import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { isIpAllowed } from "@/middleware/ip";

export function middleware(request: NextRequest) {
  // Temporary, remove this before going to production
  // When removing this, also update the matcher in the config below
  if (!isIpAllowed(request) && process.env.VERCEL_ENV) {
    return NextResponse.redirect("https://zoonk.com");
  }

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
