import "server-only";
import { adminStatsCache as cache } from "@/data/stats/_utils/admin-stats-cache";
import { prisma } from "@zoonk/db";

export const getAccuracyRate = cache(async () => {
  const [total, correct] = await Promise.all([
    prisma.stepAttempt.count(),
    prisma.stepAttempt.count({ where: { isCorrect: true } }),
  ]);

  return total === 0 ? 0 : (correct / total) * 100;
});
