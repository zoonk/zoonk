import { getLocalizedUrl } from "@/lib/metadata/localized-url";
import { COURSE_CATEGORIES } from "@zoonk/utils/categories";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@zoonk/utils/locale";
import { SITE_URL } from "@zoonk/utils/url";
import { type MetadataRoute } from "next";

const STATIC_PATHS = ["/start", "/privacy", "/terms"];

const LOCALIZED_PATHS = [
  "/",
  "/pricing",
  "/courses",
  ...COURSE_CATEGORIES.map((category) => `/courses/${category}`),
];

function getLocalizedEntries(language: SupportedLocale): MetadataRoute.Sitemap {
  return LOCALIZED_PATHS.map((href) => ({ url: getLocalizedUrl({ href, language }) }));
}

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...STATIC_PATHS.map((path) => ({ url: `${SITE_URL}${path}` })),
    ...SUPPORTED_LOCALES.flatMap((locale) => getLocalizedEntries(locale)),
  ];
}
