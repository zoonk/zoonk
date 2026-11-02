import { getSentenceSpace, getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { useLocale } from "next-intl";

export function useAppLocale() {
  return getSupportedLocaleFromLanguage(useLocale());
}

export function useSentenceSpace() {
  return getSentenceSpace(useLocale());
}
