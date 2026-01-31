import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";

export const SUPPORTED_LOCALES = ["en", "es", "pt"] as const;
export const DEFAULT_LOCALE = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function isValidLocale(value: string): value is SupportedLocale {
  return SUPPORTED_LOCALES.some((locale) => locale === value);
}

/**
 * Locale labels in their native language.
 * These should NOT be translated since they represent
 * the language name as it appears to native speakers.
 */
export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: "English",
  es: "Español",
  pt: "Português",
} as const;

/**
 * Detect the best locale from an Accept-Language header.
 */
export function getLocaleFromHeaders(acceptLanguage: string | null): string {
  if (!acceptLanguage) {
    return DEFAULT_LOCALE;
  }

  const negotiator = new Negotiator({
    headers: { "accept-language": acceptLanguage },
  });
  const languages = negotiator.languages();

  try {
    return match(languages, SUPPORTED_LOCALES, DEFAULT_LOCALE);
  } catch {
    return DEFAULT_LOCALE;
  }
}
