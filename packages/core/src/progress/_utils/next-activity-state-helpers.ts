import {
  type EffectiveLessonProgressRow,
  type PublishedLessonProgressScope,
} from "./published-lesson-progress";

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
  durableChapterIds: Set<number>;
  rows: EffectiveLessonProgressRow[];
}) {
  return (
    courseCompleted ||
    durableChapterIds.size > 0 ||
    rows.some((row) => row.completedActivities > 0 || row.isEffectivelyCompleted)
  );
}

/**
 * Durable chapter and course completion should win over the current curriculum
 * tree. Without this guard, adding one new lesson or chapter would reopen a
 * scope the learner had already earned and undo the whole durability model.
 *
 * Navigation intentionally ignores published lessons that have no current
 * activities and no pending generation work. Those rows still matter for
 * chapter progress, but they should not block continue links ahead of real work.
 */
export function isScopeCompleted({
  courseCompleted,
  durableChapterIds,
  rows,
  scope,
}: {
  courseCompleted: boolean;
  durableChapterIds: Set<number>;
  rows: EffectiveLessonProgressRow[];
  scope: PublishedLessonProgressScope;
}) {
  if ("lessonId" in scope) {
    return rows.every((row) => row.isEffectivelyCompleted || !isNavigableLesson({ row }));
  }

  if ("chapterId" in scope) {
    return (
      durableChapterIds.has(scope.chapterId) ||
      rows.every((row) => row.isEffectivelyCompleted || !isNavigableLesson({ row }))
    );
  }

  if (courseCompleted) {
    return true;
  }

  const chapterRows = groupRowsByChapter({ rows });

  return chapterRows.every(
    (chapter) =>
      durableChapterIds.has(chapter.chapterId) ||
      chapter.rows.every((row) => row.isEffectivelyCompleted || !isNavigableLesson({ row })),
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
  durableChapterIds: Set<number>;
  rows: EffectiveLessonProgressRow[];
  scope: PublishedLessonProgressScope;
}) {
  if ("lessonId" in scope) {
    return rows.every((row) => row.isDurablyCompleted || !isNavigableLesson({ row }));
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
  durableChapterIds: Set<number>;
  rows: EffectiveLessonProgressRow[];
}) {
  if (courseCompleted) {
    return null;
  }

  return (
    rows.find(
      (row) =>
        !durableChapterIds.has(row.chapterId) &&
        !row.isEffectivelyCompleted &&
        isNavigableLesson({ row }),
    ) ?? null
  );
}

/**
 * Pending generation can live either on the lesson row itself or on one of its
 * current activities. Navigation needs one shared definition so course, chapter,
 * and lesson buttons all decide the same way between deep-linking and the shell.
 */
export function hasPendingLessonContent({ row }: { row: EffectiveLessonProgressRow }) {
  return (
    row.pendingActivities > 0 ||
    (row.totalActivities === 0 && row.lessonGenerationStatus !== "completed")
  );
}

/**
 * A lesson only blocks navigation when the learner can actually do something
 * with it right now: open an activity or wait for pending generation to finish.
 * Empty completed lessons still count in chapter stats, but they should not
 * trap continue links ahead of real content.
 */
function isNavigableLesson({ row }: { row: EffectiveLessonProgressRow }) {
  return row.totalActivities > 0 || hasPendingLessonContent({ row });
}

/**
 * Course completion logic groups rows by current chapter so it can distinguish
 * a durably completed chapter from a chapter that still has open lessons now.
 */
function groupRowsByChapter({ rows }: { rows: EffectiveLessonProgressRow[] }) {
  const grouped = new Map<number, { chapterId: number; rows: EffectiveLessonProgressRow[] }>();

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
