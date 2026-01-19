import "server-only";

import { prisma } from "@zoonk/db";
import { cache } from "react";

export type ChapterWithLessons = {
  id: number;
  slug: string;
  title: string;
  description: string;
  position: number;
  lessons: {
    id: number;
    slug: string;
    title: string;
    description: string;
    position: number;
  }[];
};

const cachedListCourseChapters = cache(
  async (
    brandSlug: string,
    courseSlug: string,
    language: string,
  ): Promise<ChapterWithLessons[]> =>
    prisma.chapter.findMany({
      orderBy: { position: "asc" },
      select: {
        description: true,
        id: true,
        lessons: {
          orderBy: { position: "asc" },
          select: {
            description: true,
            id: true,
            position: true,
            slug: true,
            title: true,
          },
          where: { isPublished: true },
        },
        position: true,
        slug: true,
        title: true,
      },
      where: {
        course: {
          isPublished: true,
          language,
          organization: {
            kind: "brand",
            slug: brandSlug,
          },
          slug: courseSlug,
        },
        isPublished: true,
      },
    }),
);

export function listCourseChapters(params: {
  brandSlug: string;
  courseSlug: string;
  language: string;
}): Promise<ChapterWithLessons[]> {
  return cachedListCourseChapters(
    params.brandSlug,
    params.courseSlug,
    params.language,
  );
}
