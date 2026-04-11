import "server-only";
import { type ActivityKind, getPublishedActivityWhere, prisma } from "@zoonk/db";
import {
  hasDurableCourseCompletion,
  listDurableChapterCompletionIds,
  listDurableLessonCompletionIds,
} from "./_utils/durable-completion-queries";
import {
  type NextActivityStateAnchor,
  canPrefetchLesson,
  getFirstIncompleteLesson,
  getForwardLesson,
  getHasStartedState,
  getReviewLesson,
  getScopeDurablyCompleted,
  hasPendingLessonContent,
  isScopeCompleted,
} from "./_utils/next-activity-state-helpers";
import {
  type EffectiveLessonProgressRow,
  type PublishedLessonProgressScope,
  toEffectiveLessonProgressRows,
} from "./_utils/published-lesson-progress";
import { listPublishedLessonProgressRows } from "./_utils/published-lesson-progress-queries";

export type NextActivityState = {
  activityId: bigint | null;
  activityKind: ActivityKind | null;
  activityPosition: number;
  activityTitle: string | null;
  brandSlug: string | null;
  canPrefetch: boolean;
  chapterId: number;
  chapterSlug: string;
  completed: boolean;
  courseId: number;
  courseSlug: string;
  hasStarted: boolean;
  lessonDescription: string;
  lessonId: number;
  lessonHasPendingContent: boolean;
  lessonSlug: string;
  lessonTitle: string;
  scopeDurablyCompleted: boolean;
};

/**
 * Continue-learning surfaces and catalog buttons need the same answer to
 * "where should this learner go next?" Returning that richer internal state
 * once lets the public button helper and the home feed stay in sync.
 */
export async function getNextActivityStateForUser({
  after,
  scope,
  userId,
}: {
  after?: NextActivityStateAnchor;
  scope: PublishedLessonProgressScope;
  userId: number;
}): Promise<NextActivityState | null> {
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
        userId,
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
    userId,
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
}): NextActivityState {
  const [firstRow] = rows;

  if (!firstRow) {
    throw new Error("Cannot build completed activity state without lesson rows");
  }

  return {
    activityId: null,
    activityKind: null,
    activityPosition: 0,
    activityTitle: null,
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
    lessonSlug: firstRow.lessonSlug,
    lessonTitle: firstRow.lessonTitle,
    scopeDurablyCompleted,
  };
}

/**
 * Open lesson navigation always follows the same rule: if the lesson already
 * has a generated incomplete activity, deep-link there, otherwise keep the
 * learner on the lesson page. Centralizing that branch keeps the main loader a
 * simple pipeline instead of repeating the same shell-vs-activity logic.
 */
async function buildOpenLessonState({
  hasStarted,
  lesson,
  userId,
}: {
  hasStarted: boolean;
  lesson: EffectiveLessonProgressRow;
  userId: number;
}) {
  if (hasPendingLessonContent({ row: lesson })) {
    return toLessonShellState({
      completed: false,
      hasStarted,
      lesson,
      lessonHasPendingContent: true,
      scopeDurablyCompleted: false,
    });
  }

  const firstIncompleteActivity = await findFirstIncompleteActivity({
    lessonId: lesson.lessonId,
    userId,
  });

  if (firstIncompleteActivity) {
    return {
      activityId: firstIncompleteActivity.id,
      activityKind: firstIncompleteActivity.kind,
      activityPosition: firstIncompleteActivity.position,
      activityTitle: firstIncompleteActivity.title,
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
      lessonSlug: lesson.lessonSlug,
      lessonTitle: lesson.lessonTitle,
      scopeDurablyCompleted: false,
    };
  }

  return toLessonShellState({
    completed: false,
    hasStarted,
    lesson,
    lessonHasPendingContent: false,
    scopeDurablyCompleted: false,
  });
}

/**
 * Shell states appear in two situations: the lesson still needs generation or
 * it has no ready activity to prefetch yet. A dedicated builder keeps those
 * repeated fields consistent across both paths.
 */
function toLessonShellState({
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
    activityId: null,
    activityKind: null,
    activityPosition: 0,
    activityTitle: null,
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
    lessonSlug: lesson.lessonSlug,
    lessonTitle: lesson.lessonTitle,
    scopeDurablyCompleted,
  };
}

/**
 * Learners should resume at the first incomplete generated activity inside the
 * first incomplete lesson. If no generated activity is ready yet, callers fall
 * back to the lesson shell instead of deep-linking into a missing activity.
 */
async function findFirstIncompleteActivity({
  lessonId,
  userId,
}: {
  lessonId: number;
  userId: number;
}) {
  return prisma.activity.findFirst({
    orderBy: { position: "asc" },
    where: getPublishedActivityWhere({
      activityWhere: {
        generationStatus: "completed",
        progress: {
          none: {
            completedAt: { not: null },
            userId,
          },
        },
      },
      lessonWhere: { id: lessonId },
    }),
  });
}
