import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";

export const SUPPORTED_LOCALES = ["en", "es", "pt", "fr", "de"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en";
const DEFAULT_COUNTRY = "US";

export const LOCALE_COOKIE = "ZOONK_LOCALE";

export function isValidLocale(value: string): value is SupportedLocale {
  return SUPPORTED_LOCALES.some((locale) => locale === value);
}

/**
 * Stored content languages can include regional tags such as `pt-BR`, while
 * app routes only support base locales such as `pt`. Falling back to English
 * keeps unsupported content languages on a real route instead of inventing an
 * invalid locale prefix.
 */
export function getSupportedLocaleFromLanguage(language: string): SupportedLocale {
  try {
    const locale = new Intl.Locale(language).language;
    return isValidLocale(locale) ? locale : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
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

function parseRegion(tag: string): string | null {
  try {
    return new Intl.Locale(tag.split(";")[0]?.trim() ?? "").region ?? null;
  } catch {
    return null;
  }
}

export function getCountryFromAcceptLanguage(acceptLanguage: string | null): string {
  if (!acceptLanguage) {
    return DEFAULT_COUNTRY;
  }

  const region = acceptLanguage
    .split(",")
    .map((tag) => parseRegion(tag))
    .find(Boolean);

  return region ?? DEFAULT_COUNTRY;
}

/**
 * Treat persisted locale values as manual choices only when they are still
 * supported by the app. Bad or legacy cookie values should not block browser
 * language detection, especially after we add support for another language.
 */
function getManualLocale(value?: string | null): SupportedLocale | null {
  if (!value) {
    return null;
  }

  return isValidLocale(value) ? value : null;
}

/**
 * Detect the best locale from an Accept-Language header.
 */
export function getLocaleFromHeaders(acceptLanguage: string | null): SupportedLocale {
  if (!acceptLanguage) {
    return DEFAULT_LOCALE;
  }

  const negotiator = new Negotiator({ headers: { "accept-language": acceptLanguage } });
  const languages = negotiator.languages();

  try {
    const locale = match(languages, SUPPORTED_LOCALES, DEFAULT_LOCALE);
    return isValidLocale(locale) ? locale : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/**
 * Resolve the app locale from an explicit user choice before browser detection.
 * The locale cookie is only written when the user manually changes language, so
 * adding a new supported language later can immediately help users whose
 * browser already prefers that language.
 */
export function getLocaleFromRequest({
  acceptLanguage,
  cookieLocale,
  overrideLocale,
}: {
  acceptLanguage: string | null;
  cookieLocale?: string | null;
  overrideLocale?: string | null;
}): SupportedLocale {
  return (
    getManualLocale(overrideLocale) ??
    getManualLocale(cookieLocale) ??
    getLocaleFromHeaders(acceptLanguage)
  );
}
