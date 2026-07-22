import {
  hasDurableCourseCompletion,
  listDurableChapterCompletionIds,
  listPublishedCourseChapters,
  listPublishedLessonProgressRows,
} from "@/data/progress/progress-queries";
import { type NextLessonState, getNextLessonState } from "@zoonk/core/progress/next-lesson-state";
import {
  type PublishedCourseChapter,
  type PublishedLessonProgressRow,
} from "@zoonk/core/progress/queries";
import { type LessonKind } from "@zoonk/db";
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
}: {
  excludedLessonKinds?: LessonKind[];
  row: ContinueLearningRow;
}): Promise<ContinueLearningProgressState> {
  const scope = { courseId: row.courseId } as const;

  const [chapters, courseCompleted, durableChapterCompletionIds, rows] = await Promise.all([
    listPublishedCourseChapters({ courseId: row.courseId }),
    hasDurableCourseCompletion({ courseId: row.courseId }),
    listDurableChapterCompletionIds({ excludedLessonKinds, scope }),
    listPublishedLessonProgressRows({ excludedLessonKinds, scope }),
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
 * Resolves all candidate course states concurrently. Each nested query reaches
 * the same canonical app cache leaves used by catalog progress and buttons.
 */
export function listNextLessonStates({
  excludedLessonKinds,
  rows,
}: {
  excludedLessonKinds?: LessonKind[];
  rows: ContinueLearningRow[];
}) {
  return Promise.all(
    rows.map((row) => getContinueLearningProgressState({ excludedLessonKinds, row })),
  );
}
