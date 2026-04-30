import {
  type NextLessonState,
  getNextLessonStateForUser,
} from "@zoonk/core/progress/next-lesson-state";
import { type ContinueLearningRow } from "./continue-learning-queries";

export type ContinueLearningState = NextLessonState | null;

/**
 * Continue-learning should resolve "what's next?" from the learner's latest
 * completed position in the course so it can keep moving forward instead of
 * jumping back to earlier skipped lessons.
 */
export async function listNextLessonStates({
  rows,
  userId,
}: {
  rows: ContinueLearningRow[];
  userId: string;
}) {
  return Promise.all(
    rows.map((row) =>
      getNextLessonStateForUser({
        after: {
          chapterPosition: row.chapterPosition,
          lessonId: row.lessonId,
          lessonPosition: row.lessonPosition,
        },
        scope: { courseId: row.courseId },
        userId,
      }),
    ),
  );
}
