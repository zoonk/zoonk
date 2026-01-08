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

export const listCourseChapters = cache(
  async (params: {
    brandSlug: string;
    courseSlug: string;
    language: string;
  }): Promise<ChapterWithLessons[]> =>
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
          language: params.language,
          organization: {
            kind: "brand",
            slug: params.brandSlug,
          },
          slug: params.courseSlug,
        },
        isPublished: true,
      },
    }),
);
