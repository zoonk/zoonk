import "server-only";
import { adminStatsCache as cache } from "@/data/stats/_utils/admin-stats-cache";
import { prisma } from "@zoonk/db";

export const getPeriodLearningTime = cache(async (start: Date, end: Date) => {
  const result = await prisma.dailyProgress.aggregate({
    _sum: { timeSpentSeconds: true },
    where: { date: { gte: start, lte: end } },
  });

  return result._sum.timeSpentSeconds ?? 0;
});
