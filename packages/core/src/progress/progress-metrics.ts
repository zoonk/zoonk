import { prisma } from "@zoonk/db";

export type TotalLearningDaysData = { learningDays: number };

export type TotalLearningTimeData = { totalLearningSeconds: number };

/**
 * Returns the learner's canonical aggregate progress row for callers that have
 * already authenticated an explicit identity.
 */
export function getUserProgress({ userId }: { userId: string }) {
  return prisma.userProgress.findUnique({ where: { userId } });
}

/**
 * Counts calendar days with at least one completed lesson. Answer attempts and
 * empty placeholder rows do not create learning days by themselves.
 */
export async function getTotalLearningDays({
  userId,
}: {
  userId: string;
}): Promise<TotalLearningDaysData> {
  const learningDays = await prisma.dailyProgress.count({
    where: { OR: [{ interactiveCompleted: { gt: 0 } }, { staticCompleted: { gt: 0 } }], userId },
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
