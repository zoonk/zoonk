import {
  type NextActivityState,
  getNextActivityStateForUser,
} from "@zoonk/core/progress/next-activity-state";
import { type ContinueLearningRow } from "./continue-learning-queries";

export type ContinueLearningState = NextActivityState | null;

/**
 * Continue-learning should resolve "what's next?" from the learner's latest
 * completed position in the course so it can keep moving forward instead of
 * jumping back to earlier skipped lessons.
 */
export async function listNextActivityStates({
  rows,
  userId,
}: {
  rows: ContinueLearningRow[];
  userId: number;
}) {
  return Promise.all(
    rows.map((row) =>
      getNextActivityStateForUser({
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
