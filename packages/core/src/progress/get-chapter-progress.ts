import { toEffectiveLessonProgressRows } from "./_utils/published-lesson-progress";
import { type PublishedCourseChapter, type PublishedLessonProgressRow } from "./progress-queries";

export type ChapterProgress = { chapterId: string; completedLessons: number; totalLessons: number };

export type ChapterProgressInput = {
  chapters: PublishedCourseChapter[];
  durableChapterCompletionIds: string[];
  rows: PublishedLessonProgressRow[];
};

/**
 * Course pages need one stable chapter-level answer even when new lessons are
 * added later. Durable chapter completion wins once earned, while every other
 * chapter still derives its count from the
 * current published lessons in that chapter.
 */
export function getChapterProgress({
  chapters,
  durableChapterCompletionIds,
  rows,
}: ChapterProgressInput): ChapterProgress[] {
  const durableChapterIds = new Set(durableChapterCompletionIds);
  const effectiveRows = toEffectiveLessonProgressRows({ rows });
  const rowsByChapter = new Map<string, typeof effectiveRows>();

  for (const row of effectiveRows) {
    const chapterRows = rowsByChapter.get(row.chapterId) ?? [];
    chapterRows.push(row);
    rowsByChapter.set(row.chapterId, chapterRows);
  }

  return chapters.map(({ chapterId }) => {
    const chapterRows = rowsByChapter.get(chapterId) ?? [];
    const totalLessons = chapterRows.length;

    if (durableChapterIds.has(chapterId)) {
      return { chapterId, completedLessons: totalLessons, totalLessons };
    }

    return {
      chapterId,
      completedLessons: chapterRows.filter((row) => row.isEffectivelyCompleted).length,
      totalLessons,
    };
  });
}
