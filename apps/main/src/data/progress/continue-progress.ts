import "server-only";
import {
  getChapterContinueProgress as getNextChapterContinueProgress,
  getCourseContinueProgress as getNextCourseContinueProgress,
} from "@zoonk/core/progress/get-course-continue";
import { type LessonKind } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

export type ContinueLessonProgress = { percentComplete: number };

/**
 * Keeps optional course continuation progress from blocking the catalog while
 * core owns its authenticated calculation.
 */
export async function getCourseContinueProgress({
  courseId,
  excludedLessonKinds = [],
}: {
  courseId: string;
  excludedLessonKinds?: LessonKind[];
}): Promise<ContinueLessonProgress | null> {
  const { data } = await safeAsync(() =>
    getNextCourseContinueProgress({ courseId, excludedLessonKinds }),
  );

  return data ?? null;
}

/**
 * Keeps optional chapter continuation progress from blocking the catalog while
 * core owns its authenticated calculation.
 */
export async function getChapterContinueProgress({
  chapterId,
  excludedLessonKinds = [],
}: {
  chapterId: string;
  excludedLessonKinds?: LessonKind[];
}): Promise<ContinueLessonProgress | null> {
  const { data } = await safeAsync(() =>
    getNextChapterContinueProgress({ chapterId, excludedLessonKinds }),
  );

  return data ?? null;
}
