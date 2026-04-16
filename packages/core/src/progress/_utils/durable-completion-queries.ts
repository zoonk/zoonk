import "server-only";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

/**
 * Lesson completion is durable once earned, even if the lesson's current
 * activities are regenerated later. Read paths keep this lookup separate so
 * they can merge durable completion with current activity counts as needed.
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
    prisma.lessonCompletion.findMany({
      where: {
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
