import { DEFAULT_LOCALE, LOCALE_COOKIE, SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { defineRouting } from "next-intl/routing";

export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** next-intl's proxy names the language of every request it sees, including ones no route answers. */
export const LOCALE_HEADER = "X-NEXT-INTL-LOCALE";

export const routing = defineRouting({
  defaultLocale: DEFAULT_LOCALE,
  localeCookie: { maxAge: LOCALE_COOKIE_MAX_AGE, name: LOCALE_COOKIE },
  localePrefix: "as-needed",
  locales: SUPPORTED_LOCALES,
});
