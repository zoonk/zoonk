import { type DailyProgress, prisma } from "@zoonk/db";

export type TotalLearningDaysData = { learningDays: number };

export type TotalLearningTimeData = { totalLearningSeconds: number };

type TotalLessonsCompletedData = { totalLessonCompletions: number };

/**
 * Returns the learner's canonical aggregate progress row for callers that have
 * already authenticated an explicit identity.
 */
export function getUserProgress({ userId }: { userId: string }) {
  return prisma.userProgress.findUnique({ where: { userId } });
}

/**
 * A learning day has at least one finished activity. `lessonsCompleted` covers
 * days copied from progress kept before learning v2, which have no completion
 * counters. Answer attempts and empty placeholder rows do not create learning
 * days by themselves.
 */
export const LEARNING_DAY_WHERE = {
  OR: [
    { interactiveCompleted: { gt: 0 } },
    { lessonsCompleted: { gt: 0 } },
    { staticCompleted: { gt: 0 } },
  ],
};

/**
 * The activities finished on one day (lessons, reviews, practice): more than zero exactly on a
 * learning day. Days kept from before learning v2 only counted their lessons.
 */
export function countActivitiesCompleted(
  day: Pick<DailyProgress, "interactiveCompleted" | "lessonsCompleted" | "staticCompleted">,
): number {
  return Math.max(day.interactiveCompleted + day.staticCompleted, day.lessonsCompleted);
}

/** Counts the learner's learning days across their complete history. */
export async function getTotalLearningDays({
  userId,
}: {
  userId: string;
}): Promise<TotalLearningDaysData> {
  const learningDays = await prisma.dailyProgress.count({
    where: { ...LEARNING_DAY_WHERE, userId },
  });

  return { learningDays };
}

/** Sums the learner's durable daily lesson time across their complete history. */
export async function getTotalLearningTime({
  userId,
}: {
  userId: string;
}): Promise<TotalLearningTimeData> {
  const result = await prisma.dailyProgress.aggregate({
    _sum: { timeSpentSeconds: true },
    where: { userId },
  });

  return { totalLearningSeconds: result._sum.timeSpentSeconds ?? 0 };
}

/**
 * Sums first lesson completions from the daily totals, so the lifetime count
 * survives the lessons themselves being deleted or regenerated.
 */
export async function getTotalLessonsCompleted({
  userId,
}: {
  userId: string;
}): Promise<TotalLessonsCompletedData> {
  const result = await prisma.dailyProgress.aggregate({
    _sum: { lessonsCompleted: true },
    where: { userId },
  });

  return { totalLessonCompletions: result._sum.lessonsCompleted ?? 0 };
}
