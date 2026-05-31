import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

export const getPeriodLearningTime = cacheAdminData(async (start: Date, end: Date) => {
  const result = await prisma.dailyProgress.aggregate({
    _sum: { timeSpentSeconds: true },
    where: { date: { gte: start, lte: end } },
  });

  return result._sum.timeSpentSeconds ?? 0;
});
