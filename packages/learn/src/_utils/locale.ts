import { getSentenceSpace, getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { getTimeZoneName } from "@zoonk/utils/time-zone";
import { useLocale } from "next-intl";

export function useAppLocale() {
  return getSupportedLocaleFromLanguage(useLocale());
}

export function useSentenceSpace() {
  return getSentenceSpace(useLocale());
}

export function useTimeZoneName(timeZone: string): string {
  return getTimeZoneName({ locale: useLocale(), timeZone });
}
