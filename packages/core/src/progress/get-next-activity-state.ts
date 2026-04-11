import "server-only";
import { type ActivityKind, getPublishedActivityWhere, prisma } from "@zoonk/db";
import {
  hasDurableCourseCompletion,
  listDurableChapterCompletionIds,
  listDurableLessonCompletionIds,
} from "./_utils/durable-completion-queries";
import {
  getFirstIncompleteLesson,
  getHasStartedState,
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

type NextActivityState = {
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
  scope,
  userId,
}: {
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

  if (isScopeCompleted({ courseCompleted, durableChapterIds, rows: effectiveRows, scope })) {
    return buildCompletedScopeState({
      rows: effectiveRows,
      scopeDurablyCompleted: getScopeDurablyCompleted({
        courseCompleted,
        durableChapterIds,
        rows: effectiveRows,
        scope,
      }),
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
      scopeDurablyCompleted: getScopeDurablyCompleted({
        courseCompleted,
        durableChapterIds,
        rows: effectiveRows,
        scope,
      }),
    });
  }

  if (hasPendingLessonContent({ row: firstIncompleteLesson })) {
    return {
      activityId: null,
      activityKind: null,
      activityPosition: 0,
      activityTitle: null,
      brandSlug: firstIncompleteLesson.brandSlug,
      canPrefetch: false,
      chapterId: firstIncompleteLesson.chapterId,
      chapterSlug: firstIncompleteLesson.chapterSlug,
      completed: false,
      courseId: firstIncompleteLesson.courseId,
      courseSlug: firstIncompleteLesson.courseSlug,
      hasStarted,
      lessonDescription: firstIncompleteLesson.lessonDescription,
      lessonHasPendingContent: true,
      lessonId: firstIncompleteLesson.lessonId,
      lessonSlug: firstIncompleteLesson.lessonSlug,
      lessonTitle: firstIncompleteLesson.lessonTitle,
      scopeDurablyCompleted: false,
    };
  }

  const firstIncompleteActivity = await findFirstIncompleteActivity({
    lessonId: firstIncompleteLesson.lessonId,
    userId,
  });

  if (firstIncompleteActivity) {
    return {
      activityId: firstIncompleteActivity.id,
      activityKind: firstIncompleteActivity.kind,
      activityPosition: firstIncompleteActivity.position,
      activityTitle: firstIncompleteActivity.title,
      brandSlug: firstIncompleteLesson.brandSlug,
      canPrefetch: true,
      chapterId: firstIncompleteLesson.chapterId,
      chapterSlug: firstIncompleteLesson.chapterSlug,
      completed: false,
      courseId: firstIncompleteLesson.courseId,
      courseSlug: firstIncompleteLesson.courseSlug,
      hasStarted,
      lessonDescription: firstIncompleteLesson.lessonDescription,
      lessonHasPendingContent: false,
      lessonId: firstIncompleteLesson.lessonId,
      lessonSlug: firstIncompleteLesson.lessonSlug,
      lessonTitle: firstIncompleteLesson.lessonTitle,
      scopeDurablyCompleted: false,
    };
  }

  return {
    activityId: null,
    activityKind: null,
    activityPosition: 0,
    activityTitle: null,
    brandSlug: firstIncompleteLesson.brandSlug,
    canPrefetch: false,
    chapterId: firstIncompleteLesson.chapterId,
    chapterSlug: firstIncompleteLesson.chapterSlug,
    completed: false,
    courseId: firstIncompleteLesson.courseId,
    courseSlug: firstIncompleteLesson.courseSlug,
    hasStarted,
    lessonDescription: firstIncompleteLesson.lessonDescription,
    lessonHasPendingContent: false,
    lessonId: firstIncompleteLesson.lessonId,
    lessonSlug: firstIncompleteLesson.lessonSlug,
    lessonTitle: firstIncompleteLesson.lessonTitle,
    scopeDurablyCompleted: false,
  };
}

/**
 * Once a learner earns durable completion for a scope, UI surfaces should keep
 * showing that scope as done even if the curriculum grows later. Reusing the
 * first current activity keeps review links stable without fabricating new
 * activity progress rows.
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
    canPrefetch: true,
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
