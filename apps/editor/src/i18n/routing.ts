import { SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  defaultLocale: "en",
  localePrefix: "as-needed",
  locales: SUPPORTED_LOCALES,
});
