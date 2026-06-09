import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserRelationWhere } from "@/data/stats/_utils/analytics-user-filter";
import { prisma } from "@zoonk/db";

export const getAccuracyRate = cacheAdminData(async () => {
  const [total, correct] = await Promise.all([
    prisma.stepAttempt.count({ where: trackedAnalyticsUserRelationWhere }),
    prisma.stepAttempt.count({ where: { ...trackedAnalyticsUserRelationWhere, isCorrect: true } }),
  ]);

  return total === 0 ? 0 : (correct / total) * 100;
});
