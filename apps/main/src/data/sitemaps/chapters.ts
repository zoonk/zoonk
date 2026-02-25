import "server-only";
import { prisma } from "@zoonk/db";
import { SITEMAP_BATCH_SIZE } from "./courses";

export async function countSitemapChapters(): Promise<number> {
  return prisma.chapter.count({
    where: {
      course: {
        isPublished: true,
        organization: { kind: "brand" },
      },
      isPublished: true,
    },
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
    orderBy: { id: "asc" },
    select: {
      course: {
        select: {
          organization: { select: { slug: true } },
          slug: true,
        },
      },
      slug: true,
      updatedAt: true,
    },
    skip: page * SITEMAP_BATCH_SIZE,
    take: SITEMAP_BATCH_SIZE,
    where: {
      course: {
        isPublished: true,
        organization: { kind: "brand" },
      },
      isPublished: true,
    },
  });

  return chapters.map((chapter) => ({
    brandSlug: chapter.course.organization?.slug ?? "",
    chapterSlug: chapter.slug,
    courseSlug: chapter.course.slug,
    updatedAt: chapter.updatedAt,
  }));
}
