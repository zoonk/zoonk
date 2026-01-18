import "server-only";

import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";

export async function getSampleCourseParams() {
  const course = await prisma.course.findFirst({
    select: { language: true, slug: true },
    where: {
      isPublished: true,
      organization: { kind: "brand", slug: AI_ORG_SLUG },
    },
  });

  if (!course) {
    return [];
  }

  return [
    {
      brandSlug: AI_ORG_SLUG,
      courseSlug: course.slug,
      locale: course.language,
    },
  ];
}

export async function getSampleLessonParams() {
  const lesson = await prisma.lesson.findFirst({
    select: {
      chapter: { select: { course: { select: { slug: true } }, slug: true } },
      language: true,
      slug: true,
    },
    where: {
      chapter: {
        course: {
          isPublished: true,
          organization: { kind: "brand", slug: AI_ORG_SLUG },
        },
        isPublished: true,
      },
      isPublished: true,
    },
  });

  if (!lesson) {
    return [];
  }

  return [
    {
      brandSlug: AI_ORG_SLUG,
      chapterSlug: lesson.chapter.slug,
      courseSlug: lesson.chapter.course.slug,
      lessonSlug: lesson.slug,
      locale: lesson.language,
    },
  ];
}
