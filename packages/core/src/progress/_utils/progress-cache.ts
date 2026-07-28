import "server-only";
import { cacheTag } from "next/cache";
import {
  getChapterCacheTag,
  getChapterLessonsCacheTag,
  getCourseCacheTag,
  getCourseCurriculumCacheTag,
  getLessonCacheTag,
  getUserProgressCacheTag,
} from "../../cache/tags";
import { type LessonScope } from "../../lessons/lesson-scope";
import { getSession } from "../../users/get-session";

/** Tags a private progress result with the learner whose data it contains. */
export async function getProgressSession() {
  const session = await getSession();

  tagUserProgress(session?.user.id ?? null);

  return session;
}

/** Tags an internal private read when it contains one learner's progress. */
export function tagUserProgress(userId: string | null): void {
  if (userId) {
    cacheTag(getUserProgressCacheTag(userId));
  }
}

/** Tags a progress result with the curriculum resources that determine it. */
export function tagProgressScope(scope: LessonScope): void {
  if ("courseId" in scope) {
    cacheTag(getCourseCacheTag(scope.courseId), getCourseCurriculumCacheTag(scope.courseId));
    return;
  }

  if ("chapterId" in scope) {
    cacheTag(getChapterCacheTag(scope.chapterId), getChapterLessonsCacheTag(scope.chapterId));
    return;
  }

  cacheTag(getLessonCacheTag(scope.lessonId));
}
