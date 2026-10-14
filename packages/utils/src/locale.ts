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

/**
 * Content matching and indexing need a real supported language. A navigation
 * fallback would incorrectly identify unsupported content as English.
 */
export function getContentLocale(language: string): SupportedLocale | null {
  const locale = getLanguageSubtag(language);
  return locale && isValidLocale(locale) ? locale : null;
}

/**
 * Stored content languages can include regional tags such as `pt-BR`, while
 * app routes only support base locales such as `pt`. Falling back to English
 * keeps unsupported content languages on a real route instead of inventing an
 * invalid locale prefix.
 */
export function getSupportedLocaleFromLanguage(language: string): SupportedLocale {
  return getContentLocale(language) ?? DEFAULT_LOCALE;
}

/**
 * Locale labels in their native language.
 * These should NOT be translated since they represent
 * the language name as it appears to native speakers.
 */
export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  de: "Deutsch",
  en: "English",
  es: "Español",
  fr: "Français",
  pt: "Português",
} as const;
