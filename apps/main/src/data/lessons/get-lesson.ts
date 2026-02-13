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
    id: number;
    position: number;
    slug: string;
    title: string;
    course: {
      id: number;
      slug: string;
      title: string;
    };
  };
};

const cachedGetLesson = cache(
  async (brandSlug: string, courseSlug: string, chapterSlug: string, lessonSlug: string) => {
    const data = await prisma.lesson.findFirst({
      select: {
        chapter: {
          select: {
            course: { select: { id: true, slug: true, title: true } },
            id: true,
            position: true,
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
            organization: { kind: "brand", slug: brandSlug },
            slug: courseSlug,
          },
          isPublished: true,
          slug: chapterSlug,
        },
        isPublished: true,
        slug: lessonSlug,
      },
    });

    return data;
  },
);

export function getLesson(params: {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  lessonSlug: string;
}): Promise<LessonWithDetails | null> {
  return cachedGetLesson(
    params.brandSlug,
    params.courseSlug,
    params.chapterSlug,
    params.lessonSlug,
  );
}
