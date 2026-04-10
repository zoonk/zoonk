import "server-only";
import { getPublishedChapterWhere, prisma } from "@zoonk/db";
import { SITEMAP_BATCH_SIZE } from "./courses";

export async function countSitemapChapters(): Promise<number> {
  return prisma.chapter.count({
    where: getPublishedChapterWhere({
      courseWhere: {
        organization: { kind: "brand" },
      },
    }),
  });
}

export async function listSitemapChapters(page: number): Promise<
  {
    brandSlug: string;
    chapterSlug: string;
    courseSlug: string;
    updatedAt: Date;
  }[]
> {
  const chapters = await prisma.chapter.findMany({
    include: {
      course: { include: { organization: true } },
    },
    orderBy: { id: "asc" },
    skip: page * SITEMAP_BATCH_SIZE,
    take: SITEMAP_BATCH_SIZE,
    where: getPublishedChapterWhere({
      courseWhere: {
        organization: { kind: "brand" },
      },
    }),
  });

  return chapters.map((chapter) => ({
    brandSlug: chapter.course.organization?.slug ?? "",
    chapterSlug: chapter.slug,
    courseSlug: chapter.course.slug,
    updatedAt: chapter.updatedAt,
  }));
}
