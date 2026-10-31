import { getPathname } from "@/i18n/navigation";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  getSupportedLocaleFromLanguage,
} from "@zoonk/utils/locale";
import { SITE_URL } from "@zoonk/utils/url";

/** Content languages may be regional, so they're normalized to a supported app locale before next-intl builds the path. */
export function getLocalizedUrl({ href, language }: { href: string; language: string }): string {
  const locale = getSupportedLocaleFromLanguage(language);
  const pathname = getPathname({ href, locale });
  return new URL(pathname, SITE_URL).toString();
}

export function getLocalizedAlternates({ href, language }: { href: string; language: string }) {
  const languages = Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [locale, getLocalizedUrl({ href, language: locale })]),
  );

  return {
    canonical: getLocalizedUrl({ href, language }),
    languages: { ...languages, "x-default": getLocalizedUrl({ href, language: DEFAULT_LOCALE }) },
  };
}
