import "server-only";
import {
  getChapterCacheTag,
  getChapterLessonsCacheTag,
  getCourseCacheTag,
  getCourseCurriculumCacheTag,
  getLessonCacheTag,
  getUserProgressCacheTag,
} from "@/data/cache-tags";
import { getSession } from "@/data/users/get-session";
import { type LessonScope } from "@zoonk/core/lessons/scope";
import {
  listDurableChapterCompletionIds as queryDurableChapterCompletionIds,
  hasDurableCourseCompletion as queryDurableCourseCompletion,
  listPublishedCourseChapters as queryPublishedCourseChapters,
  listPublishedLessonProgressRows as queryPublishedLessonProgressRows,
} from "@zoonk/core/progress/queries";
import { type LessonKind } from "@zoonk/db";
import { cacheTag } from "next/cache";

type ProgressQueryInput = { excludedLessonKinds?: LessonKind[]; scope: LessonScope };

/** Returns the curriculum tags that can change a scoped progress result. */
function getProgressScopeCacheTags(scope: LessonScope): string[] {
  if ("courseId" in scope) {
    return [getCourseCacheTag(scope.courseId), getCourseCurriculumCacheTag(scope.courseId)];
  }

  if ("chapterId" in scope) {
    return [getChapterCacheTag(scope.chapterId), getChapterLessonsCacheTag(scope.chapterId)];
  }

  return [getLessonCacheTag(scope.lessonId)];
}

/** Tags progress reads with their curriculum and authenticated learner. */
function tagProgressQuery({ scope, userId }: { scope: LessonScope; userId: string | null }) {
  cacheTag(...getProgressScopeCacheTags(scope));

  if (userId) {
    cacheTag(getUserProgressCacheTag(userId));
  }
}

async function findPublishedLessonProgressRows({
  excludedLessonKinds,
  scope,
  userId,
}: ProgressQueryInput & { userId: string | null }) {
  "use cache";

  tagProgressQuery({ scope, userId });

  return queryPublishedLessonProgressRows({ excludedLessonKinds, scope, userId });
}

/** Returns published lesson progress for the current learner and scope. */
export async function listPublishedLessonProgressRows(input: ProgressQueryInput) {
  const session = await getSession();
  return findPublishedLessonProgressRows({ ...input, userId: session?.user.id ?? null });
}

/** Returns the published course outline shared by progress selectors. */
export async function listPublishedCourseChapters({ courseId }: { courseId: string }) {
  "use cache";

  cacheTag(getCourseCacheTag(courseId), getCourseCurriculumCacheTag(courseId));
  return queryPublishedCourseChapters({ courseId });
}

async function findDurableChapterCompletionIds({
  excludedLessonKinds,
  scope,
  userId,
}: ProgressQueryInput & { userId: string | null }) {
  "use cache";

  tagProgressQuery({ scope, userId });

  return queryDurableChapterCompletionIds({ excludedLessonKinds, scope, userId });
}

/** Returns durable chapter completions for the current learner and scope. */
export async function listDurableChapterCompletionIds(input: ProgressQueryInput) {
  const session = await getSession();
  return findDurableChapterCompletionIds({ ...input, userId: session?.user.id ?? null });
}

async function findDurableCourseCompletion({
  courseId,
  userId,
}: {
  courseId: string;
  userId: string | null;
}) {
  "use cache";

  cacheTag(getCourseCacheTag(courseId), getCourseCurriculumCacheTag(courseId));

  if (userId) {
    cacheTag(getUserProgressCacheTag(userId));
  }

  return queryDurableCourseCompletion({ courseId, userId });
}

/** Checks durable course completion for the current learner. */
export async function hasDurableCourseCompletion({ courseId }: { courseId: string }) {
  const session = await getSession();
  return findDurableCourseCompletion({ courseId, userId: session?.user.id ?? null });
}
