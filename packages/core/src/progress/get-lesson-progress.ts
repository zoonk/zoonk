import { getSession } from "../users/get-user-session";
import { listDurableLessonCompletionIds } from "./_utils/durable-completion-queries";
import { toEffectiveLessonProgressRows } from "./_utils/published-lesson-progress";
import { listPublishedLessonProgressRows } from "./_utils/published-lesson-progress-queries";

export async function getLessonProgress({
  chapterId,
  headers,
}: {
  chapterId: string;
  headers?: Headers;
}): Promise<
  {
    completedActivities: number;
    lessonId: string;
    totalActivities: number;
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
    lessonIds: [...new Set(rows.map((row) => row.lessonId))],
    userId,
  });

  return toEffectiveLessonProgressRows({
    durablyCompletedLessonIds: durableLessonIds,
    rows,
  })
    .filter((row) => row.totalActivities > 0)
    .map((row) => ({
      completedActivities: row.isDurablyCompleted ? row.totalActivities : row.completedActivities,
      lessonId: row.lessonId,
      totalActivities: row.totalActivities,
    }));
}
