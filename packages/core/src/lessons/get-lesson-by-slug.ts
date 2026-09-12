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
import { getSession } from "../users/get-session";

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
        userId: null,
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

async function getPrivateLesson(params: LessonRouteParams) {
  "use cache: private";
  const session = await getSession();

  if (!session) {
    return null;
  }

  const lesson = await prisma.lesson.findFirst({
    include: { chapter: { include: { course: true } } },
    where: getPublishedLessonWhere({
      chapterWhere: { slug: decodeRouteParam(params.chapterSlug) },
      courseWhere: {
        organizationId: null,
        slug: decodeRouteParam(params.courseSlug),
        userId: session.user.id,
      },
      lessonWhere: { slug: decodeRouteParam(params.lessonSlug) },
    }),
  });

  if (lesson) {
    cacheTag(
      getCourseCacheTag(lesson.chapter.courseId),
      getChapterCacheTag(lesson.chapterId),
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
  if (decodeRouteParam(params.brandSlug) === "me") {
    return getPrivateLesson(params);
  }

  return getCachedLesson({
    brandSlug: decodeRouteParam(params.brandSlug),
    chapterSlug: decodeRouteParam(params.chapterSlug),
    courseSlug: decodeRouteParam(params.courseSlug),
    lessonSlug: decodeRouteParam(params.lessonSlug),
  });
}
