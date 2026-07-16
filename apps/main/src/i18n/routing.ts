import { DEFAULT_LOCALE, LOCALE_COOKIE, SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { defineRouting } from "next-intl/routing";

const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const routing = defineRouting({
  defaultLocale: DEFAULT_LOCALE,
  localeCookie: { maxAge: LOCALE_COOKIE_MAX_AGE, name: LOCALE_COOKIE },
  localePrefix: "as-needed",
  locales: SUPPORTED_LOCALES,
});
