import "server-only";
import { getUserProgressCacheTag } from "@/data/cache-tags";
import { getSession } from "@/data/users/get-session";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getTotalLearningDaysForUser } from "./get-total-learning-days";
import { getTotalLearningTimeForUser } from "./get-total-learning-time";

export type LearningActivityTotals = {
  learningDays: number;
  totalLessonCompletions: number;
  totalLearningSeconds: number;
};

/**
 * LessonProgress records each lesson's first durable completion, so reviews
 * never inflate the lesson total shown on Home and Activity.
 */
async function findTotalCompletedLessons(userId: string): Promise<number> {
  "use cache";

  cacheTag(getUserProgressCacheTag(userId));

  return prisma.lessonProgress.count({ where: { completedAt: { not: null }, userId } });
}

/**
 * Composes the existing lifetime day and time sources with the unique lesson
 * total so every progress surface shares one definition of each metric.
 */
async function findLearningActivityTotals(userId: string): Promise<LearningActivityTotals> {
  const [learningDays, learningTime, totalLessonCompletions] = await Promise.all([
    getTotalLearningDaysForUser(userId),
    getTotalLearningTimeForUser(userId),
    findTotalCompletedLessons(userId),
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
  const session = await getSession();

  return session ? findLearningActivityTotals(session.user.id) : null;
}
