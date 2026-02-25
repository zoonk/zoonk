import "server-only";
import { prisma } from "@zoonk/db";
import { SITEMAP_BATCH_SIZE } from "./courses";

export async function countSitemapLessons(): Promise<number> {
  return prisma.lesson.count({
    where: {
      chapter: {
        course: {
          isPublished: true,
          organization: { kind: "brand" },
        },
        isPublished: true,
      },
      isPublished: true,
    },
  });
}

export async function listSitemapLessons(page: number): Promise<
  {
    brandSlug: string;
    chapterSlug: string;
    courseSlug: string;
    lessonSlug: string;
    updatedAt: Date;
  }[]
> {
  const lessons = await prisma.lesson.findMany({
    include: {
      chapter: {
        include: {
          course: { include: { organization: true } },
        },
      },
    },
    orderBy: { id: "asc" },
    skip: page * SITEMAP_BATCH_SIZE,
    take: SITEMAP_BATCH_SIZE,
    where: {
      chapter: {
        course: {
          isPublished: true,
          organization: { kind: "brand" },
        },
        isPublished: true,
      },
      isPublished: true,
    },
  });

  return lessons.map((lesson) => ({
    brandSlug: lesson.chapter.course.organization?.slug ?? "",
    chapterSlug: lesson.chapter.slug,
    courseSlug: lesson.chapter.course.slug,
    lessonSlug: lesson.slug,
    updatedAt: lesson.updatedAt,
  }));
}
