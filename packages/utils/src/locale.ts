export const SUPPORTED_LOCALES = ["en", "es", "pt"] as const;
export const DEFAULT_LOCALE = "en";

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

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
