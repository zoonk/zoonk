import "server-only";
import { getPublishedChapterWhere, prisma } from "@zoonk/db";
import { SITEMAP_BATCH_SIZE } from "./courses";

/**
 * Every published brand chapter is a public catalog page worth discovering,
 * including chapters whose lesson generation has not completed yet.
 */
const sitemapChapterWhere = getPublishedChapterWhere({
  courseWhere: { organization: { kind: "brand" } },
});

export async function countSitemapChapters(): Promise<number> {
  return prisma.chapter.count({ where: sitemapChapterWhere });
}

export async function listSitemapChapters(
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
    language: chapter.course.language,
    updatedAt: chapter.updatedAt,
  }));
}
