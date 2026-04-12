import {
  type PublishedLessonCompletionRow,
  type listPublishedCourseChapters,
} from "./durable-curriculum-completion-queries";

/**
 * Lessons only earn durable completion after every current published activity
 * is complete. Lessons with zero published activities still stay out of the
 * durable model because the learner never had anything concrete to finish.
 */
export function isCurrentLessonCompleted({ row }: { row: PublishedLessonCompletionRow }) {
  return row.totalActivities > 0 && row.completedActivities >= row.totalActivities;
}

/**
 * Chapter and course completion must respect both current direct activity
 * completion and durable lesson completions. Centralizing that shared rule
 * keeps the completion boundary consistent across every scope.
 */
function isEffectivelyCompleted({
  durableLessonIds,
  row,
}: {
  durableLessonIds: Set<number>;
  row: PublishedLessonCompletionRow;
}) {
  return durableLessonIds.has(row.lessonId) || isCurrentLessonCompleted({ row });
}

/**
 * Course completion decisions repeatedly need the lesson rows grouped by
 * chapter. Building that map once keeps the top-level sync function linear and
 * avoids embedding grouping logic inside later predicates.
 */
export function groupRowsByChapter({ rows }: { rows: PublishedLessonCompletionRow[] }) {
  const grouped = new Map<number, PublishedLessonCompletionRow[]>();

  for (const row of rows) {
    const chapterRows = grouped.get(row.chapterId) ?? [];
    chapterRows.push(row);
    grouped.set(row.chapterId, chapterRows);
  }

  return grouped;
}

/**
 * The lesson row for the just-completed activity is the only lesson that can
 * newly cross the lesson-completion boundary in this transaction. Pulling it
 * out once makes the later write conditions direct.
 */
export function getLessonRow({
  lessonId,
  rows,
}: {
  lessonId: number;
  rows: PublishedLessonCompletionRow[];
}) {
  return rows.find((row) => row.lessonId === lessonId) ?? null;
}

/**
 * Later scope decisions should see the lesson the learner just finished as
 * durably complete, even before we persist that lesson completion row. This
 * keeps chapter and course completion derivation linear inside one snapshot.
 */
export function getEffectiveDurableLessonIds({
  durableLessonIds,
  lessonRow,
}: {
  durableLessonIds: Set<number>;
  lessonRow: PublishedLessonCompletionRow | null;
}) {
  if (!lessonRow || !isCurrentLessonCompleted({ row: lessonRow })) {
    return durableLessonIds;
  }

  return new Set([...durableLessonIds, lessonRow.lessonId]);
}

/**
 * A chapter earns durable completion once every current published lesson in
 * that chapter is effectively complete. Empty chapters stay incomplete so a
 * course cannot become durable before every visible chapter has real work.
 */
export function isCurrentChapterCompleted({
  chapterId,
  durableLessonIds,
  rowsByChapter,
}: {
  chapterId: number;
  durableLessonIds: Set<number>;
  rowsByChapter: Map<number, PublishedLessonCompletionRow[]>;
}) {
  const chapterRows = rowsByChapter.get(chapterId) ?? [];

  return (
    chapterRows.length > 0 &&
    chapterRows.every((row) => isEffectivelyCompleted({ durableLessonIds, row }))
  );
}

/**
 * Course completion should immediately see a newly completed chapter as
 * durable, even before its row is written. This mirrors the lesson-level rule
 * above and keeps the whole completion cascade derived from one snapshot.
 */
export function getEffectiveDurableChapterIds({
  chapterId,
  durableChapterIds,
  isChapterCompleted,
}: {
  chapterId: number;
  durableChapterIds: Set<number>;
  isChapterCompleted: boolean;
}) {
  if (!isChapterCompleted) {
    return durableChapterIds;
  }

  return new Set([...durableChapterIds, chapterId]);
}

/**
 * A course earns durable completion once every published chapter is covered by
 * a durable chapter completion or by effectively completed lessons. Chapters
 * with no lesson rows stay incomplete so new empty curriculum shells do not
 * accidentally count as finished.
 */
export function isCurrentCourseCompleted({
  chapters,
  durableChapterIds,
  durableLessonIds,
  rowsByChapter,
}: {
  chapters: Awaited<ReturnType<typeof listPublishedCourseChapters>>;
  durableChapterIds: Set<number>;
  durableLessonIds: Set<number>;
  rowsByChapter: Map<number, PublishedLessonCompletionRow[]>;
}) {
  if (chapters.length === 0) {
    return false;
  }

  return chapters.every((chapter) => {
    if (durableChapterIds.has(chapter.id)) {
      return true;
    }

    const chapterRows = rowsByChapter.get(chapter.id) ?? [];

    return (
      chapterRows.length > 0 &&
      chapterRows.every((row) => isEffectivelyCompleted({ durableLessonIds, row }))
    );
  });
}
