import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
  locales: SUPPORTED_LOCALES,
});
