export const SUPPORTED_LOCALES = ["en", "es", "pt", "fr", "de"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en";

export const LOCALE_COOKIE = "ZOONK_LOCALE";

export function isValidLocale(value: string): value is SupportedLocale {
  return SUPPORTED_LOCALES.some((locale) => locale === value);
}

function getLanguageSubtag(language: string): string | null {
  try {
    return new Intl.Locale(language).language ?? null;
  } catch {
    return null;
  }
}

/** Null for an unsupported language: a fallback would mark that content as English. */
export function getContentLocale(language: string): SupportedLocale | null {
  const locale = getLanguageSubtag(language);
  return locale && isValidLocale(locale) ? locale : null;
}

export function getSupportedLocaleFromLanguage(language: string): SupportedLocale {
  return getContentLocale(language) ?? DEFAULT_LOCALE;
}

/** Native names, never translated. */
export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  de: "Deutsch",
  en: "English",
  es: "Español",
  fr: "Français",
  pt: "Português",
} as const;
