import { type LessonKind } from "@zoonk/db";
import { type NextLessonState, getNextLessonState } from "../../progress/get-next-lesson-state";
import {
  type PublishedCourseChapter,
  type PublishedLessonProgressRow,
  hasDurableCourseCompletion,
  listDurableChapterCompletionIds,
  listPublishedCourseChapters,
  listPublishedLessonProgressRows,
} from "../../progress/progress-queries";
import { type ContinueLearningRow } from "./continue-learning-queries";

export type ContinueLearningState = NextLessonState | null;

export type ContinueLearningProgressState = {
  chapters: PublishedCourseChapter[];
  durableChapterCompletionIds: string[];
  rows: PublishedLessonProgressRow[];
  state: ContinueLearningState;
};

/**
 * Loads every independent query needed to resolve one course's current state
 * in a single wave, then delegates all navigation rules to the pure core
 * selector. The recent completion row remains the forward-navigation anchor.
 */
async function getContinueLearningProgressState({
  excludedLessonKinds,
  row,
  userId,
}: {
  excludedLessonKinds?: LessonKind[];
  row: ContinueLearningRow;
  userId: string;
}): Promise<ContinueLearningProgressState> {
  const scope = { courseId: row.courseId } as const;

  const [chapters, courseCompleted, durableChapterCompletionIds, rows] = await Promise.all([
    listPublishedCourseChapters({ courseId: row.courseId }),
    hasDurableCourseCompletion({ courseId: row.courseId, userId }),
    listDurableChapterCompletionIds({ excludedLessonKinds, scope, userId }),
    listPublishedLessonProgressRows({ excludedLessonKinds, scope, userId }),
  ]);

  const state = getNextLessonState({
    after: {
      chapterPosition: row.chapterPosition,
      lessonId: row.lessonId,
      lessonPosition: row.lessonPosition,
    },
    courseCompleted,
    durableChapterCompletionIds,
    rows,
    scope,
  });

  return { chapters, durableChapterCompletionIds, rows, state };
}

/**
 * Resolves all candidate course states concurrently. Each candidate keeps its
 * four independent curriculum and learner-state reads in one query wave.
 */
export function listNextLessonStates({
  excludedLessonKinds,
  rows,
  userId,
}: {
  excludedLessonKinds?: LessonKind[];
  rows: ContinueLearningRow[];
  userId: string;
}) {
  return Promise.all(
    rows.map((row) => getContinueLearningProgressState({ excludedLessonKinds, row, userId })),
  );
}
