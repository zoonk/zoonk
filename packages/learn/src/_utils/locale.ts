import { getSentenceSpace, getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { useLocale } from "next-intl";

export function useAppLocale() {
  return getSupportedLocaleFromLanguage(useLocale());
}

export function useSentenceSpace() {
  return getSentenceSpace(useLocale());
}

export function useTimeZoneName(timeZone: string): string {
  const name = new Intl.DateTimeFormat(useLocale(), { timeZone, timeZoneName: "longGeneric" })
    .formatToParts()
    .find((part) => part.type === "timeZoneName");

  return name?.value ?? timeZone;
}
