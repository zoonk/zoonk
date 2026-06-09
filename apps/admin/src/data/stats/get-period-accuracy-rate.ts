import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserRelationWhere } from "@/data/stats/_utils/analytics-user-filter";
import { prisma } from "@zoonk/db";

export const getPeriodAccuracyRate = cacheAdminData(async (start: Date, end: Date) => {
  const where = { ...trackedAnalyticsUserRelationWhere, answeredAt: { gte: start, lte: end } };

  const [total, correct] = await Promise.all([
    prisma.stepAttempt.count({ where }),
    prisma.stepAttempt.count({ where: { ...where, isCorrect: true } }),
  ]);

  return total === 0 ? 0 : (correct / total) * 100;
});
