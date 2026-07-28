import "server-only";
import { type LessonGetPayload, getPublishedLessonWhere, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import {
  getChapterCacheTag,
  getCourseCacheTag,
  getLessonCacheTag,
  getLessonRouteCacheTag,
} from "../cache/tags";
import { decodeRouteParam } from "../navigation/decode-route-param";

export type CatalogLesson = LessonGetPayload<{
  include: { chapter: { include: { course: true } } };
}>;

type LessonRouteParams = {
  brandSlug: string;
  chapterSlug: string;
  courseSlug: string;
  lessonSlug: string;
};

/**
 * Caches one normalized lesson route and tags the lesson plus its embedded
 * chapter and course so each resource can invalidate the shared result.
 */
async function getCachedLesson(params: LessonRouteParams) {
  "use cache";
  cacheTag(getLessonRouteCacheTag(params));

  const lesson = await prisma.lesson.findFirst({
    include: { chapter: { include: { course: true } } },
    where: getPublishedLessonWhere({
      chapterWhere: { slug: params.chapterSlug },
      courseWhere: {
        organization: { kind: "brand", slug: params.brandSlug },
        slug: params.courseSlug,
      },
      lessonWhere: { slug: params.lessonSlug },
    }),
  });

  if (lesson) {
    cacheTag(
      getCourseCacheTag(lesson.chapter.course.id),
      getChapterCacheTag(lesson.chapter.id),
      getLessonCacheTag(lesson.id),
    );
  }

  return lesson;
}

/**
 * Loads the published lesson identified by its complete catalog route. Route
 * normalization happens before caching while the query enforces the lesson,
 * chapter, course, and brand publication hierarchy together.
 */
export async function getLesson(params: LessonRouteParams) {
  return getCachedLesson({
    brandSlug: decodeRouteParam(params.brandSlug),
    chapterSlug: decodeRouteParam(params.chapterSlug),
    courseSlug: decodeRouteParam(params.courseSlug),
    lessonSlug: decodeRouteParam(params.lessonSlug),
  });
}
