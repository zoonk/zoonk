import "server-only";
import { getPublishedLessonWhere, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getChapterCacheTag, getCourseCacheTag, getLessonCacheTag } from "../cache/tags";

/**
 * Loads one published lesson shell by its stable resource ID while enforcing
 * the full public brand curriculum hierarchy. Parent IDs are returned with the
 * lesson so API clients can navigate without depending on web route slugs.
 */
export async function getLessonById({ lessonId }: { lessonId: string }) {
  "use cache";

  cacheTag(getLessonCacheTag(lessonId));

  const lesson = await prisma.lesson.findFirst({
    include: { chapter: true },
    where: getPublishedLessonWhere({
      courseWhere: { organization: { kind: "brand" } },
      lessonWhere: { id: lessonId },
    }),
  });

  if (lesson) {
    cacheTag(getChapterCacheTag(lesson.chapterId), getCourseCacheTag(lesson.chapter.courseId));
  }

  return lesson;
}
