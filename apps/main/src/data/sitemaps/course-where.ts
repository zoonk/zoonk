import "server-only";
import { getPublishedCourseWhere, prisma } from "@zoonk/db";
import { getContentLocale } from "@zoonk/utils/locale";

/**
 * Resolve the small set of stored language tags with the same strict locale
 * parser as page metadata. Filtering in the database keeps sitemap counts and
 * pagination correct without treating unsupported languages as English.
 */
export async function getSitemapCourseWhere() {
  const languages = await prisma.course.groupBy({
    by: ["language"],
    where: getPublishedCourseWhere({ organization: { kind: "brand" }, userId: null }),
  });

  const supportedLanguages = languages
    .filter(({ language }) => getContentLocale(language) !== null)
    .map(({ language }) => language);

  return getPublishedCourseWhere({
    language: { in: supportedLanguages },
    organization: { kind: "brand" },
    userId: null,
  });
}
