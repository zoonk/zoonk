import "server-only";
import {
  type ProgressHistoryOptions,
  readLifetimeDailyProgress,
} from "./_utils/daily-progress-rows";
import { getProgressSession } from "./_utils/progress-cache";
import {
  countActivitiesCompleted,
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
  history,
  userId,
}: ProgressHistoryOptions & { userId: string }): Promise<LearningActivityTotals> {
  if (history === "lifetime") {
    const rows = await readLifetimeDailyProgress(userId);

    return {
      learningDays: rows.filter((row) => countActivitiesCompleted(row) > 0).length,
      totalLearningSeconds: rows.reduce((sum, row) => sum + row.timeSpentSeconds, 0),
      totalLessonCompletions: rows.reduce((sum, row) => sum + row.lessonsCompleted, 0),
    };
  }

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
export async function getLearningActivityTotals({
  history,
}: ProgressHistoryOptions = {}): Promise<LearningActivityTotals | null> {
  "use cache: private";

  const session = await getProgressSession();

  return session ? findLearningActivityTotals({ history, userId: session.user.id }) : null;
}
