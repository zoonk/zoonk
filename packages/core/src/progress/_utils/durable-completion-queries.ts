import "server-only";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

/**
 * Lesson completion lives on lesson progress and stays durable for read paths
 * that need to merge current curriculum state with completed lessons.
 */
export async function listDurableLessonCompletionIds({
  lessonIds,
  userId,
}: {
  lessonIds: string[];
  userId?: string;
}): Promise<Set<string>> {
  if (lessonIds.length === 0 || !userId) {
    return new Set();
  }

  const { data } = await safeAsync(() =>
    prisma.lessonProgress.findMany({
      where: {
        completedAt: { not: null },
        lessonId: { in: lessonIds },
        userId,
      },
    }),
  );

  return new Set((data ?? []).map((row) => row.lessonId));
}

/**
 * Chapter completion is durable once earned, even if new lessons are published
 * later. Read paths need this set so they can keep completed chapters closed
 * instead of reopening them whenever the curriculum grows.
 */
export async function listDurableChapterCompletionIds({
  chapterIds,
  userId,
}: {
  chapterIds: string[];
  userId?: string;
}): Promise<Set<string>> {
  if (chapterIds.length === 0 || !userId) {
    return new Set();
  }

  const { data } = await safeAsync(() =>
    prisma.chapterCompletion.findMany({
      where: {
        chapterId: { in: chapterIds },
        userId,
      },
    }),
  );

  return new Set((data ?? []).map((row) => row.chapterId));
}

/**
 * Course completion is the top-level durable badge for learner achievement.
 * Continue-learning surfaces use this check to avoid reopening a course just
 * because new chapters were added after the learner had already finished it.
 */
export async function hasDurableCourseCompletion({
  courseId,
  userId,
}: {
  courseId: string;
  userId?: string;
}): Promise<boolean> {
  if (!userId) {
    return false;
  }

  const { data } = await safeAsync(() =>
    prisma.courseCompletion.findUnique({
      where: { userCourseCompletion: { courseId, userId } },
    }),
  );

  return Boolean(data);
}
