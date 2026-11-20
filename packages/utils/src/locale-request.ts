import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale, isValidLocale } from "./locale";

/**
 * Only servers and the proxy need a header parser and a locale matcher, so this lives apart from
 * the locale list browsers import.
 */

const DEFAULT_COUNTRY = "US";

function parseRegion(tag: string): string | null {
  try {
    return new Intl.Locale(tag.split(";")[0]?.trim() ?? "").region ?? null;
  } catch {
    return null;
  }
}

function getCountryFromAcceptLanguage(acceptLanguage: string | null): string {
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
 * Where the request came from, which Vercel reads from its IP address; null where Vercel doesn't
 * add it (local runs) or can't place the address. The one fact about a learner's location: a
 * browser's language says what they read, not where they live.
 */
export function getIpCountry(headers: Pick<Headers, "get">): string | null {
  return headers.get("x-vercel-ip-country");
}

/** The IP's country, or the browser's language region without one, for a price or a consent rule that needs an answer. */
export function getRequestCountry(headers: Pick<Headers, "get">): string {
  return getIpCountry(headers) ?? getCountryFromAcceptLanguage(headers.get("accept-language"));
}

function getManualLocale(value?: string | null): SupportedLocale | null {
  if (!value) {
    return null;
  }

  return isValidLocale(value) ? value : null;
}

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
