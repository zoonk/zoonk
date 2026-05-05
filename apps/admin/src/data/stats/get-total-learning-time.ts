import "server-only";
import { adminStatsCache as cache } from "@/data/stats/_utils/admin-stats-cache";
import { prisma } from "@zoonk/db";

export const getTotalLearningTime = cache(async () => {
  const result = await prisma.dailyProgress.aggregate({ _sum: { timeSpentSeconds: true } });

  return result._sum.timeSpentSeconds ?? 0;
});
