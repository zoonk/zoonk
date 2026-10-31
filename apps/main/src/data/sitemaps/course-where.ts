import "server-only";
import { getListedCourseWhere, prisma } from "@zoonk/db";
import { getContentLocale } from "@zoonk/utils/locale";

async function getSitemapLanguages(): Promise<string[]> {
  "use cache";

  const languages = await prisma.course.groupBy({
    by: ["language"],
    where: getListedCourseWhere(),
  });

  return languages
    .filter(({ language }) => getContentLocale(language) !== null)
    .map(({ language }) => language);
}

export async function getSitemapCourseWhere() {
  return getListedCourseWhere({ language: { in: await getSitemapLanguages() } });
}
