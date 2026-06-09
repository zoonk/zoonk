import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserRelationWhere } from "@/data/stats/_utils/analytics-user-filter";
import { prisma } from "@zoonk/db";

export const getTotalLearningTime = cacheAdminData(async () => {
  const result = await prisma.dailyProgress.aggregate({
    _sum: { timeSpentSeconds: true },
    where: trackedAnalyticsUserRelationWhere,
  });

  return result._sum.timeSpentSeconds ?? 0;
});
