import "server-only";
import { type LessonScope } from "@zoonk/core/lessons/scope";
import { getChapterProgress } from "@zoonk/core/progress/chapters";
import { getContinueLessonTarget } from "@zoonk/core/progress/continue-lesson-target";
import { getLessonProgress } from "@zoonk/core/progress/lessons";
import {
  getLastCompletedLessonAnchor,
  getNextLessonState,
} from "@zoonk/core/progress/next-lesson-state";
import {
  hasDurableCourseCompletion,
  listDurableChapterCompletionIds,
  listPublishedCourseChapters,
  listPublishedLessonProgressRows,
} from "@zoonk/core/progress/queries";

/**
 * Builds course completion from independent core reads after the API route has
 * established the current user. Guests keep the existing empty-list response.
 */
export async function readCourseCompletion({
  courseId,
  userId,
}: {
  courseId: string;
  userId: string | null;
}) {
  if (!userId) {
    return [];
  }

  const scope = { courseId } as const;

  const [chapters, durableChapterCompletionIds, rows] = await Promise.all([
    listPublishedCourseChapters({ courseId }),
    listDurableChapterCompletionIds({ scope, userId }),
    listPublishedLessonProgressRows({ scope, userId }),
  ]);

  return getChapterProgress({ chapters, durableChapterCompletionIds, rows });
}

/**
 * Builds lesson completion from the signed-in learner's explicit progress
 * reads while preserving the public endpoint's empty response for guests.
 */
export async function readChapterCompletion({
  chapterId,
  userId,
}: {
  chapterId: string;
  userId: string | null;
}) {
  if (!userId) {
    return [];
  }

  const scope = { chapterId } as const;

  const rows = await listPublishedLessonProgressRows({ scope, userId });
  return getLessonProgress({ rows });
}

/**
 * Loads every continuation input in one parallel wave, then applies the pure
 * core selectors so guest and authenticated navigation keep the same contract.
 */
export async function readNextLessonTarget({
  scope,
  userId,
}: {
  scope: LessonScope;
  userId: string | null;
}) {
  const courseId = "courseId" in scope ? scope.courseId : null;

  const [chapters, courseCompleted, durableChapterCompletionIds, rows] = await Promise.all([
    courseId ? listPublishedCourseChapters({ courseId }) : Promise.resolve([]),
    courseId ? hasDurableCourseCompletion({ courseId, userId }) : Promise.resolve(false),
    listDurableChapterCompletionIds({ scope, userId }),
    listPublishedLessonProgressRows({ scope, userId }),
  ]);

  const state = getNextLessonState({
    after: getLastCompletedLessonAnchor({ rows }),
    courseCompleted,
    durableChapterCompletionIds,
    rows,
    scope,
  });

  return getContinueLessonTarget({ chapters, scope, state });
}
