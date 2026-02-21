import { SITE_URL } from "@zoonk/utils/constants";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { type MetadataRoute } from "next";

const STATIC_PATHS = ["/", "/courses", "/learn", "/privacy", "/terms"];

function buildAlternates(path: string): Record<string, string> {
  const defaultUrl = `${SITE_URL}${path}`;

  const localeEntries: [string, string][] = SUPPORTED_LOCALES.map((locale) => {
    const prefix = locale === DEFAULT_LOCALE ? "" : `/${locale}`;
    return [locale, `${SITE_URL}${prefix}${path}`];
  });

  return Object.fromEntries([["x-default", defaultUrl], ...localeEntries]);
}

export default function sitemap(): MetadataRoute.Sitemap {
  return STATIC_PATHS.map((path) => ({
    alternates: { languages: buildAlternates(path) },
    url: `${SITE_URL}${path}`,
  }));
}
