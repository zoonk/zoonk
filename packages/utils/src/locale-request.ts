import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale, isValidLocale } from "./locale";

/**
 * Reading a request's language and country needs a header parser and a locale matcher, which only
 * servers and the proxy need, so they live apart from the locale list browsers import.
 */

const DEFAULT_COUNTRY = "US";

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
function getLocaleFromHeaders(acceptLanguage: string | null): SupportedLocale {
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
