import "server-only";
import { getProgressSession } from "./_utils/progress-cache";
import {
  getTotalLearningDays,
  getTotalLearningTime,
  getTotalLessonsCompleted,
} from "./progress-metrics";

export type LearningActivityTotals = {
  learningDays: number;
  totalLessonCompletions: number;
  totalLearningSeconds: number;
};

/**
 * Composes the lifetime day, time and first-completion totals from the daily
 * table so every progress surface shares one definition of each metric.
 */
async function findLearningActivityTotals({
  userId,
}: {
  userId: string;
}): Promise<LearningActivityTotals> {
  const [learningDays, learningTime, lessonsCompleted] = await Promise.all([
    getTotalLearningDays({ userId }),
    getTotalLearningTime({ userId }),
    getTotalLessonsCompleted({ userId }),
  ]);

  return {
    learningDays: learningDays.learningDays,
    totalLearningSeconds: learningTime.totalLearningSeconds,
    totalLessonCompletions: lessonsCompleted.totalLessonCompletions,
  };
}

/**
 * Returns the signed-in learner's lifetime activity totals without loading the
 * daily calendar rows used only by the Activity page.
 */
export async function getLearningActivityTotals(): Promise<LearningActivityTotals | null> {
  "use cache: private";

  const session = await getProgressSession();

  return session ? findLearningActivityTotals({ userId: session.user.id }) : null;
}
