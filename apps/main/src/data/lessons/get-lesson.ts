import "server-only";

import { prisma } from "@zoonk/db";
import { cache } from "react";

export type LessonWithDetails = {
  id: number;
  slug: string;
  title: string;
  description: string;
  position: number;
  chapter: {
    slug: string;
    title: string;
    course: {
      slug: string;
      title: string;
    };
  };
};

export const getLesson = cache(
  async (params: {
    brandSlug: string;
    chapterSlug: string;
    courseSlug: string;
    lessonSlug: string;
  }): Promise<LessonWithDetails | null> =>
    prisma.lesson.findFirst({
      select: {
        chapter: {
          select: {
            course: { select: { slug: true, title: true } },
            slug: true,
            title: true,
          },
        },
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
            organization: { kind: "brand", slug: params.brandSlug },
            slug: params.courseSlug,
          },
          isPublished: true,
          slug: params.chapterSlug,
        },
        isPublished: true,
        slug: params.lessonSlug,
      },
    }),
);
