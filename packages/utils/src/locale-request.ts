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

/** Vercel's IP country, or the browser's language region where Vercel doesn't add it (local runs). */
export function getRequestCountry(headers: Pick<Headers, "get">): string {
  return (
    headers.get("x-vercel-ip-country") ??
    getCountryFromAcceptLanguage(headers.get("accept-language"))
  );
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
