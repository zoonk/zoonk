import { getSession } from "../users/get-user-session";
import {
  listDurableChapterCompletionIds,
  listDurableLessonCompletionIds,
} from "./_utils/durable-completion-queries";
import { toEffectiveLessonProgressRows } from "./_utils/published-lesson-progress";
import {
  listPublishedChaptersForCourse,
  listPublishedLessonProgressRows,
} from "./_utils/published-lesson-progress-queries";

/**
 * Course pages need one stable chapter-level answer even when new lessons are
 * added later. Durable chapter completion wins once earned, while every other
 * chapter still derives its count from the
 * current published lessons in that chapter.
 */
function getChapterProgressRows({
  chapterIds,
  durableChapterIds,
  rows,
}: {
  chapterIds: { chapterId: string }[];
  durableChapterIds: Set<string>;
  rows: ReturnType<typeof toEffectiveLessonProgressRows>;
}) {
  const rowsByChapter = new Map<string, typeof rows>();

  for (const row of rows) {
    const chapterRows = rowsByChapter.get(row.chapterId) ?? [];
    chapterRows.push(row);
    rowsByChapter.set(row.chapterId, chapterRows);
  }

  return chapterIds.map(({ chapterId }) => {
    const chapterRows = rowsByChapter.get(chapterId) ?? [];
    const totalLessons = chapterRows.length;

    if (durableChapterIds.has(chapterId)) {
      return {
        chapterId,
        completedLessons: totalLessons,
        totalLessons,
      };
    }

    return {
      chapterId,
      completedLessons: chapterRows.filter((row) => row.isEffectivelyCompleted).length,
      totalLessons,
    };
  });
}

/**
 * This query powers the chapter list progress on the course page.
 * We count every published lesson in a published chapter because the catalog
 * should only show a chapter as complete once every listed lesson is done.
 * A lesson with zero published lessons is therefore still part of the total,
 * but it cannot count as completed yet.
 */
export async function getChapterProgress({
  courseId,
  headers,
}: {
  courseId: string;
  headers?: Headers;
}): Promise<
  {
    chapterId: string;
    completedLessons: number;
    totalLessons: number;
  }[]
> {
  const session = await getSession(headers);
  const userId = session?.user.id;

  if (!userId) {
    return [];
  }

  const [chapterIds, rows] = await Promise.all([
    listPublishedChaptersForCourse({ courseId }),
    listPublishedLessonProgressRows({
      scope: { courseId },
      userId,
    }),
  ]);

  const [durableLessonIds, durableChapterIds] = await Promise.all([
    listDurableLessonCompletionIds({
      lessonIds: [...new Set(rows.map((row) => row.lessonId))],
      userId,
    }),
    listDurableChapterCompletionIds({
      chapterIds: chapterIds.map((chapter) => chapter.chapterId),
      userId,
    }),
  ]);

  return getChapterProgressRows({
    chapterIds,
    durableChapterIds,
    rows: toEffectiveLessonProgressRows({
      durablyCompletedLessonIds: durableLessonIds,
      rows,
    }),
  });
}
