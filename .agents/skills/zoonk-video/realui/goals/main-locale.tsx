// Stands in for Main's server-only `@/i18n/locale` in the components buddy-gen.py copies.
import { getSupportedLocaleFromLanguage } from "@repo/packages/utils/src/locale.ts";
import { useLocale } from "next-intl";

export function getAppLocale() {
  return getSupportedLocaleFromLanguage(useLocale());
}
