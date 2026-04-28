import {
  type EffectiveLessonProgressRow,
  type PublishedLessonProgressScope,
} from "./published-lesson-progress";

export type NextLessonStateAnchor = {
  chapterPosition: number;
  lessonId: string;
  lessonPosition: number;
};

/**
 * Catalog buttons only distinguish "start" from "continue" after at least one
 * durable or direct completion exists. Started-but-unfinished attempts have not
 * counted historically, so this helper preserves that simpler contract.
 */
export function getHasStartedState({
  courseCompleted,
  durableChapterIds,
  rows,
}: {
  courseCompleted: boolean;
  durableChapterIds: Set<string>;
  rows: EffectiveLessonProgressRow[];
}) {
  return (
    courseCompleted ||
    durableChapterIds.size > 0 ||
    rows.some((row) => row.completedLessons > 0 || row.isEffectivelyCompleted)
  );
}

/**
 * Durable chapter and course completion should win over the current curriculum
 * tree. Without this guard, adding one new lesson or chapter would reopen a
 * scope the learner had already earned and undo the whole durability model.
 */
export function isScopeCompleted({
  courseCompleted,
  durableChapterIds,
  rows,
  scope,
}: {
  courseCompleted: boolean;
  durableChapterIds: Set<string>;
  rows: EffectiveLessonProgressRow[];
  scope: PublishedLessonProgressScope;
}) {
  if ("lessonId" in scope) {
    return rows.every((row) => row.isEffectivelyCompleted);
  }

  if ("chapterId" in scope) {
    return (
      durableChapterIds.has(scope.chapterId) || rows.every((row) => row.isEffectivelyCompleted)
    );
  }

  if (courseCompleted) {
    return true;
  }

  const chapterRows = groupRowsByChapter({ rows });

  return chapterRows.every(
    (chapter) =>
      durableChapterIds.has(chapter.chapterId) ||
      chapter.rows.every((row) => row.isEffectivelyCompleted),
  );
}

/**
 * Continue-learning needs to know whether a completed scope was earned via a
 * durable completion badge or only because the current tree has no remaining
 * work. That distinction decides whether a newly added chapter should surface.
 */
export function getScopeDurablyCompleted({
  courseCompleted,
  durableChapterIds,
  rows,
  scope,
}: {
  courseCompleted: boolean;
  durableChapterIds: Set<string>;
  rows: EffectiveLessonProgressRow[];
  scope: PublishedLessonProgressScope;
}) {
  if ("lessonId" in scope) {
    return rows.every((row) => row.isDurablyCompleted);
  }

  if ("chapterId" in scope) {
    return durableChapterIds.has(scope.chapterId);
  }

  return courseCompleted;
}

/**
 * The next destination is the first lesson in structural order that is not
 * already covered by durable chapter completion or by effective lesson
 * completion in the current revision.
 */
export function getFirstIncompleteLesson({
  courseCompleted,
  durableChapterIds,
  rows,
}: {
  courseCompleted: boolean;
  durableChapterIds: Set<string>;
  rows: EffectiveLessonProgressRow[];
}) {
  if (courseCompleted) {
    return null;
  }

  return (
    rows.find((row) => !durableChapterIds.has(row.chapterId) && !row.isEffectivelyCompleted) ?? null
  );
}

/**
 * Started learners should continue from their latest lesson position, not jump
 * back to earlier skipped shells. This helper keeps the current lesson when it
 * still has open work, otherwise it scans only later lessons in tree order.
 */
export function getForwardLesson({
  after,
  courseCompleted,
  durableChapterIds,
  rows,
}: {
  after: NextLessonStateAnchor;
  courseCompleted: boolean;
  durableChapterIds: Set<string>;
  rows: EffectiveLessonProgressRow[];
}) {
  if (courseCompleted) {
    return null;
  }

  const currentLesson = getLessonById({ lessonId: after.lessonId, rows });

  if (currentLesson && isForwardLessonOpen({ durableChapterIds, row: currentLesson })) {
    return currentLesson;
  }

  return (
    getRowsAfterAnchor({ after, rows }).find((row) =>
      isForwardLessonOpen({ durableChapterIds, row }),
    ) ?? null
  );
}

/**
 * When a learner reaches the end of the forward path inside a scope, review
 * should stay anchored to the lesson they were actually on instead of falling
 * back to the first lesson in the tree.
 */
export function getReviewLesson({
  after,
  rows,
}: {
  after: NextLessonStateAnchor;
  rows: EffectiveLessonProgressRow[];
}) {
  return getLessonById({ lessonId: after.lessonId, rows });
}

/**
 * Continue links should only prefetch a lesson when its playable content is
 * ready. Pending lessons still route through the player, but callers should
 * avoid prefetching work that may trigger generation messaging instead.
 */
export function canPrefetchLesson({ row }: { row: EffectiveLessonProgressRow }) {
  return row.totalLessons > 0 && row.pendingLessons === 0;
}

/**
 * Pending generation can live either on the lesson row itself or on one of its
 * current lessons. Navigation needs one shared definition so course, chapter,
 * and lesson buttons all decide the same way about prefetching.
 */
export function hasPendingLessonContent({ row }: { row: EffectiveLessonProgressRow }) {
  return (
    row.pendingLessons > 0 || (row.totalLessons === 0 && row.lessonGenerationStatus !== "completed")
  );
}

/**
 * Course completion logic groups rows by current chapter so it can distinguish
 * a durably completed chapter from a chapter that still has open lessons now.
 */
function groupRowsByChapter({ rows }: { rows: EffectiveLessonProgressRow[] }) {
  const grouped = new Map<string, { chapterId: string; rows: EffectiveLessonProgressRow[] }>();

  for (const row of rows) {
    const current = grouped.get(row.chapterId);

    if (current) {
      current.rows.push(row);
    } else {
      grouped.set(row.chapterId, { chapterId: row.chapterId, rows: [row] });
    }
  }

  return [...grouped.values()];
}

/**
 * Anchor-aware navigation only needs lessons at or after one structural
 * position. Extracting that filter keeps the forward-only rule readable.
 */
function getRowsAfterAnchor({
  after,
  rows,
}: {
  after: NextLessonStateAnchor;
  rows: EffectiveLessonProgressRow[];
}) {
  return rows.filter((row) => isRowAfterAnchor({ after, row }));
}

/**
 * A row is "after" the anchor only when it belongs to a later lesson in the
 * published tree. The current lesson is handled separately by getForwardLesson.
 */
function isRowAfterAnchor({
  after,
  row,
}: {
  after: NextLessonStateAnchor;
  row: EffectiveLessonProgressRow;
}) {
  return (
    row.chapterPosition > after.chapterPosition ||
    (row.chapterPosition === after.chapterPosition && row.lessonPosition > after.lessonPosition)
  );
}

/**
 * Forward navigation should only stop on lessons that still matter for the
 * learner: not durably completed at the chapter level and not already complete
 * in the lesson itself.
 */
function isForwardLessonOpen({
  durableChapterIds,
  row,
}: {
  durableChapterIds: Set<string>;
  row: EffectiveLessonProgressRow;
}) {
  return !durableChapterIds.has(row.chapterId) && !row.isEffectivelyCompleted;
}

/**
 * Looking up the anchored lesson by id is clearer as a named helper than as an
 * inline array search repeated in multiple branches.
 */
function getLessonById({
  lessonId,
  rows,
}: {
  lessonId: string;
  rows: EffectiveLessonProgressRow[];
}) {
  return rows.find((row) => row.lessonId === lessonId) ?? null;
}
