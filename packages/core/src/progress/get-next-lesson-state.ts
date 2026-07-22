import { type LessonKind } from "@zoonk/db";
import { type LessonScope } from "../lessons/lesson-scope";
import {
  canPrefetchLesson,
  getFirstIncompleteLesson,
  getForwardLesson,
  getHasStartedState,
  getReviewLesson,
  getScopeDurablyCompleted,
  hasPendingLessonContent,
  isScopeCompleted,
} from "./_utils/next-lesson-state-helpers";
import {
  type EffectiveLessonProgressRow,
  toEffectiveLessonProgressRows,
} from "./_utils/published-lesson-progress";
import { type PublishedLessonProgressRow } from "./progress-queries";

export type NextLessonStateAnchor = {
  chapterPosition: number;
  lessonId: string;
  lessonPosition: number;
};

export type NextLessonState = {
  lessonId: string;
  lessonKind: LessonKind;
  lessonPosition: number;
  lessonTitle: string | null;
  brandSlug: string | null;
  canPrefetch: boolean;
  chapterId: string;
  chapterPosition: number;
  chapterSlug: string;
  chapterTitle: string;
  completed: boolean;
  courseId: string;
  courseSlug: string;
  hasStarted: boolean;
  lessonDescription: string | null;
  lessonHasPendingContent: boolean;
  lessonSlug: string;
  scopeDurablyCompleted: boolean;
};

export type NextLessonStateInput = {
  after?: NextLessonStateAnchor;
  courseCompleted: boolean;
  durableChapterCompletionIds: string[];
  rows: PublishedLessonProgressRow[];
  scope: LessonScope;
};

/**
 * Finds the furthest completed lesson in the already loaded published tree.
 * The progress rows use the same scope, visibility, and lesson-kind filters as
 * continuation, so deriving the anchor here avoids a second overlapping query.
 */
export function getLastCompletedLessonAnchor({
  rows,
}: {
  rows: PublishedLessonProgressRow[];
}): NextLessonStateAnchor | undefined {
  const completedRow = toEffectiveLessonProgressRows({ rows }).findLast(
    (row) => row.isEffectivelyCompleted,
  );

  if (!completedRow) {
    return undefined;
  }

  return {
    chapterPosition: completedRow.chapterPosition,
    lessonId: completedRow.lessonId,
    lessonPosition: completedRow.lessonPosition,
  };
}

/**
 * Continue-learning surfaces and catalog buttons need the same answer to
 * "where should this learner go next?" Returning that richer internal state
 * once lets the public button helper and the home feed stay in sync.
 */
export function getNextLessonState({
  after,
  courseCompleted,
  durableChapterCompletionIds,
  rows,
  scope,
}: NextLessonStateInput): NextLessonState | null {
  if (rows.length === 0) {
    return null;
  }

  const durableChapterIds = new Set(durableChapterCompletionIds);

  const effectiveRows = toEffectiveLessonProgressRows({ rows });

  const hasStarted = getHasStartedState({
    courseCompleted,
    durableChapterIds,
    rows: effectiveRows,
  });

  const scopeDurablyCompleted = getScopeDurablyCompleted({
    courseCompleted,
    durableChapterIds,
    rows: effectiveRows,
    scope,
  });

  if (after) {
    const forwardLesson = getForwardLesson({
      after,
      courseCompleted,
      durableChapterIds,
      rows: effectiveRows,
    });

    if (forwardLesson) {
      return buildOpenLessonState({ hasStarted, lesson: forwardLesson });
    }

    const firstIncompleteLesson = getFirstIncompleteLesson({
      courseCompleted,
      durableChapterIds,
      rows: effectiveRows,
    });

    if (firstIncompleteLesson) {
      return buildOpenLessonState({ hasStarted, lesson: firstIncompleteLesson });
    }

    const reviewLesson = getReviewLesson({ after, rows: effectiveRows });

    return buildCompletedScopeState({
      rows: reviewLesson ? [reviewLesson] : effectiveRows,
      scopeDurablyCompleted,
    });
  }

  if (isScopeCompleted({ courseCompleted, durableChapterIds, rows: effectiveRows, scope })) {
    return buildCompletedScopeState({ rows: effectiveRows, scopeDurablyCompleted });
  }

  const firstIncompleteLesson = getFirstIncompleteLesson({
    courseCompleted,
    durableChapterIds,
    rows: effectiveRows,
  });

  if (!firstIncompleteLesson) {
    return buildCompletedScopeState({ rows: effectiveRows, scopeDurablyCompleted });
  }

  return buildOpenLessonState({ hasStarted, lesson: firstIncompleteLesson });
}

/**
 * Once a learner reaches a review state, UI surfaces should keep that state
 * anchored to one concrete lesson row. For a normal completed scope that is
 * the last structural lesson; for forward-only started navigation it is the
 * anchored lesson passed in by the caller.
 */
function buildCompletedScopeState({
  rows,
  scopeDurablyCompleted,
}: {
  rows: EffectiveLessonProgressRow[];
  scopeDurablyCompleted: boolean;
}): NextLessonState {
  const row = rows.at(-1);

  if (!row) {
    throw new Error("Cannot build completed lesson state without lesson rows");
  }

  return {
    brandSlug: row.brandSlug,
    canPrefetch: canPrefetchLesson({ row }),
    chapterId: row.chapterId,
    chapterPosition: row.chapterPosition,
    chapterSlug: row.chapterSlug,
    chapterTitle: row.chapterTitle,
    completed: true,
    courseId: row.courseId,
    courseSlug: row.courseSlug,
    hasStarted: true,
    lessonDescription: row.lessonDescription,
    lessonHasPendingContent: false,
    lessonId: row.lessonId,
    lessonKind: row.lessonKind,
    lessonPosition: row.lessonPosition,
    lessonSlug: row.lessonSlug,
    lessonTitle: row.lessonTitle,
    scopeDurablyCompleted,
  };
}

/**
 * Open lesson navigation can be prefetched once playable content is ready.
 * Pending lessons still return a concrete player target without prefetching.
 */
function buildOpenLessonState({
  hasStarted,
  lesson,
}: {
  hasStarted: boolean;
  lesson: EffectiveLessonProgressRow;
}): NextLessonState {
  if (hasPendingLessonContent({ row: lesson })) {
    return toPendingLessonState({
      completed: false,
      hasStarted,
      lesson,
      lessonHasPendingContent: true,
      scopeDurablyCompleted: false,
    });
  }

  if (!lesson.isEffectivelyCompleted) {
    return {
      brandSlug: lesson.brandSlug,
      canPrefetch: true,
      chapterId: lesson.chapterId,
      chapterPosition: lesson.chapterPosition,
      chapterSlug: lesson.chapterSlug,
      chapterTitle: lesson.chapterTitle,
      completed: false,
      courseId: lesson.courseId,
      courseSlug: lesson.courseSlug,
      hasStarted,
      lessonDescription: lesson.lessonDescription,
      lessonHasPendingContent: false,
      lessonId: lesson.lessonId,
      lessonKind: lesson.lessonKind,
      lessonPosition: lesson.lessonPosition,
      lessonSlug: lesson.lessonSlug,
      lessonTitle: lesson.lessonTitle,
      scopeDurablyCompleted: false,
    };
  }

  return toPendingLessonState({
    completed: false,
    hasStarted,
    lesson,
    lessonHasPendingContent: false,
    scopeDurablyCompleted: false,
  });
}

/**
 * Pending states appear when the lesson still needs generation or has no ready
 * player content to prefetch yet. A dedicated builder keeps those repeated fields consistent.
 */
function toPendingLessonState({
  completed,
  hasStarted,
  lesson,
  lessonHasPendingContent,
  scopeDurablyCompleted,
}: {
  completed: boolean;
  hasStarted: boolean;
  lesson: EffectiveLessonProgressRow;
  lessonHasPendingContent: boolean;
  scopeDurablyCompleted: boolean;
}): NextLessonState {
  return {
    brandSlug: lesson.brandSlug,
    canPrefetch: false,
    chapterId: lesson.chapterId,
    chapterPosition: lesson.chapterPosition,
    chapterSlug: lesson.chapterSlug,
    chapterTitle: lesson.chapterTitle,
    completed,
    courseId: lesson.courseId,
    courseSlug: lesson.courseSlug,
    hasStarted,
    lessonDescription: lesson.lessonDescription,
    lessonHasPendingContent,
    lessonId: lesson.lessonId,
    lessonKind: lesson.lessonKind,
    lessonPosition: lesson.lessonPosition,
    lessonSlug: lesson.lessonSlug,
    lessonTitle: lesson.lessonTitle,
    scopeDurablyCompleted,
  };
}
