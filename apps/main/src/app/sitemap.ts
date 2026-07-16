import { getLocalizedUrl } from "@/lib/metadata/localized-url";
import { COURSE_CATEGORIES } from "@zoonk/utils/categories";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@zoonk/utils/locale";
import { SITE_URL } from "@zoonk/utils/url";
import { type MetadataRoute } from "next";

const STATIC_PATHS = [
  "/",
  "/start",
  "/start/speak",
  "/start/learn",
  "/start/exam",
  "/privacy",
  "/terms",
];

const COURSE_PATHS = ["/courses", ...COURSE_CATEGORIES.map((category) => `/courses/${category}`)];

/**
 * Course discovery pages are translated and filtered by locale, so every
 * supported locale is its own indexable page rather than a duplicate shell.
 */
function getLocalizedCourseEntries(language: SupportedLocale): MetadataRoute.Sitemap {
  return COURSE_PATHS.map((href) => ({ url: getLocalizedUrl({ href, language }) }));
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...STATIC_PATHS.map((path) => ({ url: `${SITE_URL}${path}` })),
    ...SUPPORTED_LOCALES.flatMap((locale) => getLocalizedCourseEntries(locale)),
  ];
}
