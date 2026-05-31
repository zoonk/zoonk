import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

export const getTotalLearningTime = cacheAdminData(async () => {
  const result = await prisma.dailyProgress.aggregate({ _sum: { timeSpentSeconds: true } });

  return result._sum.timeSpentSeconds ?? 0;
});
