import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

const cachedGetLesson = cache(
  async (brandSlug: string, courseSlug: string, chapterSlug: string, lessonSlug: string) =>
    prisma.lesson.findFirst({
      include: {
        chapter: {
          include: { course: true },
        },
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
    }),
);

export function getLesson(params: {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  lessonSlug: string;
}) {
  return cachedGetLesson(
    params.brandSlug,
    params.courseSlug,
    params.chapterSlug,
    params.lessonSlug,
  );
}

export type LessonWithDetails = NonNullable<Awaited<ReturnType<typeof getLesson>>>;
