import { getPublishedLessonWhere, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { getSession } from "../users/get-user-session";
import { listDurableLessonCompletionIds } from "./_utils/durable-completion-queries";
import { toEffectiveLessonProgressRows } from "./_utils/published-lesson-progress";
import { listPublishedLessonProgressRows } from "./_utils/published-lesson-progress-queries";

export async function getLessonProgress({
  lessonId,
  headers,
}: {
  lessonId: string;
  headers?: Headers;
}): Promise<string[]> {
  const session = await getSession(headers);
  const userId = session?.user.id;

  if (!userId) {
    return [];
  }

  const { data: lessonProgress } = await safeAsync(() =>
    prisma.lessonProgress.findUnique({
      where: {
        userLesson: {
          lessonId,
          userId,
        },
      },
    }),
  );

  if (lessonProgress?.completedAt) {
    const { data: lesson } = await safeAsync(() =>
      prisma.lesson.findFirst({
        where: getPublishedLessonWhere({ lessonWhere: { id: lessonId } }),
      }),
    );

    return lesson ? [lesson.id] : [];
  }

  return [];
}

/**
 * Chapter pages need one progress row per listed lesson so the catalog can
 * show completion without loading every lesson separately.
 */
export async function getChapterLessonProgress({
  chapterId,
  headers,
}: {
  chapterId: string;
  headers?: Headers;
}): Promise<
  {
    completedLessons: number;
    lessonId: string;
    totalLessons: number;
  }[]
> {
  const session = await getSession(headers);
  const userId = session?.user.id;

  if (!userId) {
    return [];
  }

  const rows = await listPublishedLessonProgressRows({
    scope: { chapterId },
    userId,
  });

  const durableLessonIds = await listDurableLessonCompletionIds({
    lessonIds: rows.map((row) => row.lessonId),
    userId,
  });

  return toEffectiveLessonProgressRows({
    durablyCompletedLessonIds: durableLessonIds,
    rows,
  }).map((row) => ({
    completedLessons: row.isEffectivelyCompleted ? row.totalLessons : row.completedLessons,
    lessonId: row.lessonId,
    totalLessons: row.totalLessons,
  }));
}
