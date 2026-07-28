import "server-only";
import { prisma } from "@zoonk/db";
import { getProgressSession } from "./_utils/progress-cache";
import { getTotalLearningDays, getTotalLearningTime } from "./progress-metrics";

export type LearningActivityTotals = {
  learningDays: number;
  totalLessonCompletions: number;
  totalLearningSeconds: number;
};

/**
 * LessonProgress records each lesson's first durable completion, so reviews
 * never inflate the lesson total shown on Home and Activity.
 */
function findTotalCompletedLessons({ userId }: { userId: string }): Promise<number> {
  return prisma.lessonProgress.count({ where: { completedAt: { not: null }, userId } });
}

/**
 * Composes the existing lifetime day and time sources with the unique lesson
 * total so every progress surface shares one definition of each metric.
 */
async function findLearningActivityTotals({
  userId,
}: {
  userId: string;
}): Promise<LearningActivityTotals> {
  const [learningDays, learningTime, totalLessonCompletions] = await Promise.all([
    getTotalLearningDays({ userId }),
    getTotalLearningTime({ userId }),
    findTotalCompletedLessons({ userId }),
  ]);

  return {
    learningDays: learningDays.learningDays,
    totalLearningSeconds: learningTime.totalLearningSeconds,
    totalLessonCompletions,
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
