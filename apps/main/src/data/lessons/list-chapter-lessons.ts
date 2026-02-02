import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export type LessonForList = {
  id: number;
  slug: string;
  title: string;
  description: string;
  position: number;
};

const cachedListChapterLessons = cache(
  async (brandSlug: string, courseSlug: string, chapterSlug: string): Promise<LessonForList[]> =>
    prisma.lesson.findMany({
      orderBy: { position: "asc" },
      select: {
        description: true,
        id: true,
        position: true,
        slug: true,
        title: true,
      },
      where: {
        chapter: {
          course: {
            isPublished: true,
            organization: { kind: "brand", slug: brandSlug },
            slug: courseSlug,
          },
          isPublished: true,
          slug: chapterSlug,
        },
        isPublished: true,
      },
    }),
);

export function listChapterLessons(params: {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
}): Promise<LessonForList[]> {
  return cachedListChapterLessons(params.brandSlug, params.courseSlug, params.chapterSlug);
}
