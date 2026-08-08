import { type SupportedLocale, isValidLocale } from "@zoonk/utils/locale";
import { type NextRequest } from "next/server";

export const AUTH_LOCALE_HEADER = "x-zoonk-auth-locale";

/**
 * Accepts locale handoffs only on central-auth pages. API clients cannot use
 * this query parameter to change the locale cookie or the request locale.
 */
export function getAuthLocale(request: NextRequest): SupportedLocale | null {
  if (!request.nextUrl.pathname.startsWith("/auth/")) {
    return null;
  }

  const locale = request.nextUrl.searchParams.get("locale");

  return locale && isValidLocale(locale) ? locale : null;
}
