export const SUPPORTED_LOCALES = [
  "en",
  "es",
  "pt",
  "fr",
  "de",
  "it",
  "ja",
  "ko",
  "tr",
  "pl",
] as const;
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

/** Plain `es` writes numbers and dates Spain's way (1.234,56), but the app's Spanish and its courses are Mexico's. */
const FORMATTING_LOCALES: ReadonlyMap<string, string> = new Map([["es", "es-MX"]]);

export function getFormattingLocale(language: string): string {
  return FORMATTING_LOCALES.get(language) ?? language;
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
  it: "Italiano",
  ja: "日本語",
  ko: "한국어",
  pl: "Polski",
  pt: "Português",
  tr: "Türkçe",
} as const;
