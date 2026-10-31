import { getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { useLocale } from "next-intl";

export function useAppLocale() {
  return getSupportedLocaleFromLanguage(useLocale());
}
