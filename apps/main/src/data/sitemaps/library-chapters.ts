import "server-only";
import { prisma } from "@zoonk/db";
import { getSitemapCourseWhere } from "./course-where";
import { SITEMAP_BATCH_SIZE } from "./courses";

/**
 * A shared chapter is listed once, at its home placement (the course it was
 * made for), which is also its canonical URL. Chapters whose lessons aren't
 * written yet are public pages too.
 */
async function getSitemapLibraryChapterWhere() {
  return { homeCourse: await getSitemapCourseWhere(), visibility: "public" as const };
}

export async function countSitemapLibraryChapters(): Promise<number> {
  return prisma.chapter.count({ where: await getSitemapLibraryChapterWhere() });
}

export async function listSitemapLibraryChapters(
  page: number,
): Promise<
  {
    brandSlug: string;
    chapterSlug: string;
    courseSlug: string;
    language: string;
    updatedAt: Date;
  }[]
> {
  const chapters = await prisma.chapter.findMany({
    orderBy: { id: "asc" },
    select: {
      homeCourse: {
        select: { language: true, organization: { select: { slug: true } }, slug: true },
      },
      slug: true,
      updatedAt: true,
    },
    skip: page * SITEMAP_BATCH_SIZE,
    take: SITEMAP_BATCH_SIZE,
    where: await getSitemapLibraryChapterWhere(),
  });

  return chapters.flatMap(({ homeCourse, slug, updatedAt }) =>
    homeCourse
      ? [
          {
            brandSlug: homeCourse.organization?.slug ?? "",
            chapterSlug: slug,
            courseSlug: homeCourse.slug,
            language: homeCourse.language,
            updatedAt,
          },
        ]
      : [],
  );
}
