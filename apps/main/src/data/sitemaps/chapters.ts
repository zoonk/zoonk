import "server-only";
import { getPublishedChapterWhere, prisma } from "@zoonk/db";
import { SITEMAP_BATCH_SIZE } from "./courses";

/**
 * Search engines should only receive chapter URLs that have real public lesson
 * content behind them. Pending, running, and failed chapters are still useful
 * in the app because learners can start generation from those pages, but adding
 * them to the sitemap asks Google to index empty "chapter not available" pages.
 */
const sitemapChapterWhere = getPublishedChapterWhere({
  chapterWhere: { generationStatus: "completed" },
  courseWhere: { organization: { kind: "brand" } },
});

export async function countSitemapChapters(): Promise<number> {
  return prisma.chapter.count({ where: sitemapChapterWhere });
}

export async function listSitemapChapters(
  page: number,
): Promise<{ brandSlug: string; chapterSlug: string; courseSlug: string; updatedAt: Date }[]> {
  const chapters = await prisma.chapter.findMany({
    include: { course: { include: { organization: true } } },
    orderBy: { id: "asc" },
    skip: page * SITEMAP_BATCH_SIZE,
    take: SITEMAP_BATCH_SIZE,
    where: sitemapChapterWhere,
  });

  return chapters.map((chapter) => ({
    brandSlug: chapter.course.organization?.slug ?? "",
    chapterSlug: chapter.slug,
    courseSlug: chapter.course.slug,
    updatedAt: chapter.updatedAt,
  }));
}
