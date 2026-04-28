import "server-only";
import { type LessonKind } from "@zoonk/db";
import {
  hasDurableCourseCompletion,
  listDurableChapterCompletionIds,
  listDurableLessonCompletionIds,
} from "./_utils/durable-completion-queries";
import {
  type NextLessonStateAnchor,
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
  type PublishedLessonProgressScope,
  toEffectiveLessonProgressRows,
} from "./_utils/published-lesson-progress";
import { listPublishedLessonProgressRows } from "./_utils/published-lesson-progress-queries";

export type NextLessonState = {
  lessonId: string;
  lessonKind: LessonKind;
  lessonPosition: number;
  lessonTitle: string;
  brandSlug: string | null;
  canPrefetch: boolean;
  chapterId: string;
  chapterSlug: string;
  completed: boolean;
  courseId: string;
  courseSlug: string;
  hasStarted: boolean;
  lessonDescription: string;
  lessonHasPendingContent: boolean;
  lessonSlug: string;
  scopeDurablyCompleted: boolean;
};

/**
 * Continue-learning surfaces and catalog buttons need the same answer to
 * "where should this learner go next?" Returning that richer internal state
 * once lets the public button helper and the home feed stay in sync.
 */
export async function getNextLessonStateForUser({
  after,
  scope,
  userId,
}: {
  after?: NextLessonStateAnchor;
  scope: PublishedLessonProgressScope;
  userId?: string;
}): Promise<NextLessonState | null> {
  const rows = await listPublishedLessonProgressRows({ scope, userId });

  if (rows.length === 0) {
    return null;
  }

  const [durableLessonIds, durableChapterIds, courseCompleted] = await Promise.all([
    listDurableLessonCompletionIds({
      lessonIds: [...new Set(rows.map((row) => row.lessonId))],
      userId,
    }),
    listDurableChapterCompletionIds({
      chapterIds: [...new Set(rows.map((row) => row.chapterId))],
      userId,
    }),
    "courseId" in scope
      ? hasDurableCourseCompletion({ courseId: scope.courseId, userId })
      : Promise.resolve(false),
  ]);

  const effectiveRows = toEffectiveLessonProgressRows({
    durablyCompletedLessonIds: durableLessonIds,
    rows,
  });

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
      return buildOpenLessonState({
        hasStarted,
        lesson: forwardLesson,
      });
    }

    const reviewLesson = getReviewLesson({
      after,
      rows: effectiveRows,
    });

    return buildCompletedScopeState({
      rows: reviewLesson ? [reviewLesson] : effectiveRows,
      scopeDurablyCompleted,
    });
  }

  if (isScopeCompleted({ courseCompleted, durableChapterIds, rows: effectiveRows, scope })) {
    return buildCompletedScopeState({
      rows: effectiveRows,
      scopeDurablyCompleted,
    });
  }

  const firstIncompleteLesson = getFirstIncompleteLesson({
    courseCompleted,
    durableChapterIds,
    rows: effectiveRows,
  });

  if (!firstIncompleteLesson) {
    return buildCompletedScopeState({
      rows: effectiveRows,
      scopeDurablyCompleted,
    });
  }

  return buildOpenLessonState({
    hasStarted,
    lesson: firstIncompleteLesson,
  });
}

/**
 * Once a learner reaches a review state, UI surfaces should keep that state
 * anchored to one concrete lesson row. For a normal completed scope that is
 * the first structural lesson; for forward-only started navigation it is the
 * anchored lesson passed in by the caller.
 */
function buildCompletedScopeState({
  rows,
  scopeDurablyCompleted,
}: {
  rows: EffectiveLessonProgressRow[];
  scopeDurablyCompleted: boolean;
}): NextLessonState {
  const [firstRow] = rows;

  if (!firstRow) {
    throw new Error("Cannot build completed lesson state without lesson rows");
  }

  return {
    brandSlug: firstRow.brandSlug,
    canPrefetch: canPrefetchLesson({ row: firstRow }),
    chapterId: firstRow.chapterId,
    chapterSlug: firstRow.chapterSlug,
    completed: true,
    courseId: firstRow.courseId,
    courseSlug: firstRow.courseSlug,
    hasStarted: true,
    lessonDescription: firstRow.lessonDescription,
    lessonHasPendingContent: false,
    lessonId: firstRow.lessonId,
    lessonKind: firstRow.lessonKind,
    lessonPosition: firstRow.lessonPosition,
    lessonSlug: firstRow.lessonSlug,
    lessonTitle: firstRow.lessonTitle,
    scopeDurablyCompleted,
  };
}

/**
 * Open lesson navigation can be prefetched once playable content is ready.
 * Pending lessons still return a concrete player target without prefetching.
 */
async function buildOpenLessonState({
  hasStarted,
  lesson,
}: {
  hasStarted: boolean;
  lesson: EffectiveLessonProgressRow;
}) {
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
      chapterSlug: lesson.chapterSlug,
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
}) {
  return {
    brandSlug: lesson.brandSlug,
    canPrefetch: false,
    chapterId: lesson.chapterId,
    chapterSlug: lesson.chapterSlug,
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
