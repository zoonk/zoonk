import { type DailyProgress, prisma } from "@zoonk/db";

export type TotalLearningDaysData = { learningDays: number };

export type TotalLearningTimeData = { totalLearningSeconds: number };

type TotalLessonsCompletedData = { totalLessonCompletions: number };

/** Internal query: caller must authorize userId first. */
export function getUserProgress({ userId }: { userId: string }) {
  return prisma.userProgress.findUnique({ where: { userId } });
}

/** Time and answer attempts alone do not create a learning day; older imported rows may have only lesson totals. */
export const LEARNING_DAY_WHERE = {
  OR: [
    { interactiveCompleted: { gt: 0 } },
    { lessonsCompleted: { gt: 0 } },
    { staticCompleted: { gt: 0 } },
  ],
};

/** Older imported daily rows may contain lesson totals without completion counters. */
export function countActivitiesCompleted(
  day: Pick<DailyProgress, "interactiveCompleted" | "lessonsCompleted" | "staticCompleted">,
): number {
  return Math.max(day.interactiveCompleted + day.staticCompleted, day.lessonsCompleted);
}

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
