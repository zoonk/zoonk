import "server-only";
import { prisma } from "@zoonk/db";
import { getSitemapCourseWhere } from "./course-where";
import { getSitemapPageRowIds, isSitemapPage, warnIfSitemapPageIsFull } from "./sitemap-pages";

/**
 * A shared chapter is listed once, at its home placement (the course it was
 * made for), which is also its canonical URL. Chapters whose lessons aren't
 * written yet are public pages too.
 */
async function getSitemapLibraryChapterWhere() {
  return { homeCourse: await getSitemapCourseWhere(), visibility: "public" as const };
}

type SitemapChapter = {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  language: string;
  updatedAt: Date;
};

/** A page's chapters (`getSitemapPage`), cached. */
async function listSitemapLibraryChapterPage(page: number): Promise<SitemapChapter[]> {
  "use cache";

  const where = await getSitemapLibraryChapterWhere();
  const listed = await prisma.chapter.findMany({ select: { id: true }, where });
  const ids = getSitemapPageRowIds({ listed, page, resource: "library-chapters" });
  warnIfSitemapPageIsFull({ page, resource: "library-chapters", rows: ids.length });

  const chapters = await prisma.chapter.findMany({
    orderBy: { id: "asc" },
    select: {
      homeCourse: {
        select: { language: true, organization: { select: { slug: true } }, slug: true },
      },
      slug: true,
      updatedAt: true,
    },
    where: { ...where, id: { in: ids } },
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

export async function listSitemapLibraryChapters(page: number): Promise<SitemapChapter[]> {
  return isSitemapPage({ page, resource: "library-chapters" })
    ? listSitemapLibraryChapterPage(page)
    : [];
}
