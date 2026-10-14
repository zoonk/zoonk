import "server-only";
import { getListedCourseWhere, prisma } from "@zoonk/db";
import { getContentLocale } from "@zoonk/utils/locale";
import { cacheLife } from "next/cache";

/**
 * The stored course languages the sitemaps list, resolved with the same strict locale parser as
 * page metadata. Read once a day for every sitemap and robots.txt, rather than once per query.
 */
async function getSitemapLanguages(): Promise<string[]> {
  "use cache";
  cacheLife("days");

  const languages = await prisma.course.groupBy({
    by: ["language"],
    where: getListedCourseWhere(),
  });

  return languages
    .filter(({ language }) => getContentLocale(language) !== null)
    .map(({ language }) => language);
}

/**
 * Filtering by the supported languages in the database keeps sitemap pages correct without
 * treating unsupported languages as English.
 */
export async function getSitemapCourseWhere() {
  return getListedCourseWhere({ language: { in: await getSitemapLanguages() } });
}
