import { getPathname } from "@/i18n/navigation";
import { getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { SITE_URL } from "@zoonk/utils/url";

/**
 * Search-facing URLs must use the same `as-needed` locale strategy as browser
 * navigation. Content languages may be regional, so they are normalized to a
 * supported app locale before next-intl builds the pathname.
 */
export function getLocalizedUrl({ href, language }: { href: string; language: string }): string {
  const locale = getSupportedLocaleFromLanguage(language);
  const pathname = getPathname({ href, locale });
  return new URL(pathname, SITE_URL).toString();
}
