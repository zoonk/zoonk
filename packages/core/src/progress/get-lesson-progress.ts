import { getSession } from "../users/get-user-session";
import { listDurableLessonCompletionIds } from "./_utils/durable-completion-queries";
import { toEffectiveLessonProgressRows } from "./_utils/published-lesson-progress";
import { listPublishedLessonProgressRows } from "./_utils/published-lesson-progress-queries";

/**
 * Chapter pages need one progress row per listed lesson so the catalog can
 * show completion without loading every lesson separately.
 */
export async function getLessonProgress({
  chapterId,
  headers,
}: {
  chapterId: string;
  headers?: Headers;
}): Promise<
  {
    isCompleted: boolean;
    lessonId: string;
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
  }).map((row) => ({
    isCompleted: row.isEffectivelyCompleted,
    lessonId: row.lessonId,
  }));
}
