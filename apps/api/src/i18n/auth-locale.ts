import { type SupportedLocale, isValidLocale } from "@zoonk/utils/locale";
import { type NextRequest } from "next/server";

export const AUTH_LOCALE_HEADER = "x-zoonk-auth-locale";

/** Only central-auth pages take the handoff, so API clients can't change the locale with it. */
export function getAuthLocale(request: NextRequest): SupportedLocale | null {
  if (!request.nextUrl.pathname.startsWith("/auth/")) {
    return null;
  }

  const locale = request.nextUrl.searchParams.get("locale");

  return locale && isValidLocale(locale) ? locale : null;
}
