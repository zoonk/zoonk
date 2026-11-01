import "server-only";
import { prisma } from "@zoonk/db";
import { getSitemapCourseWhere } from "./course-where";
import { getSitemapPageRowIds, isSitemapPage, warnIfSitemapPageIsFull } from "./sitemap-pages";

/** A shared chapter is listed once, at its home placement, which is also its canonical URL. */
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

async function listSitemapLibraryChapterPage(page: number): Promise<SitemapChapter[]> {
  "use cache";

  const [where, ids] = await Promise.all([
    getSitemapLibraryChapterWhere(),
    getSitemapPageRowIds({ page, resource: "library-chapters" }),
  ]);

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

  warnIfSitemapPageIsFull({ page, resource: "library-chapters", rows: chapters.length });

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
