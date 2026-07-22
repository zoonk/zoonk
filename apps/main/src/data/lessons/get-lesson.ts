import "server-only";
import { getCourseCacheTag, getLessonCacheTag, getLessonRouteCacheTag } from "@/data/cache-tags";
import { type LessonGetPayload, getPublishedLessonWhere, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { decodeRouteParam } from "../_utils/route-params";

export type CatalogLesson = LessonGetPayload<{
  include: { chapter: { include: { course: true } } };
}>;

/**
 * Caches the public lesson shell briefly so metadata, Open Graph images, and the
 * player route reuse the same published hierarchy lookup.
 */
export async function getLesson(params: {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  lessonSlug: string;
}) {
  "use cache";

  const brandSlug = decodeRouteParam(params.brandSlug);
  const chapterSlug = decodeRouteParam(params.chapterSlug);
  const courseSlug = decodeRouteParam(params.courseSlug);
  const lessonSlug = decodeRouteParam(params.lessonSlug);

  cacheTag(getLessonRouteCacheTag({ brandSlug, chapterSlug, courseSlug, lessonSlug }));

  const lesson = await prisma.lesson.findFirst({
    include: { chapter: { include: { course: true } } },
    where: getPublishedLessonWhere({
      chapterWhere: { slug: chapterSlug },
      courseWhere: { organization: { kind: "brand", slug: brandSlug }, slug: courseSlug },
      lessonWhere: { slug: lessonSlug },
    }),
  });

  if (lesson) {
    cacheTag(getCourseCacheTag(lesson.chapter.course.id), getLessonCacheTag(lesson.id));
  }

  return lesson;
}
