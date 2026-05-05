import "server-only";
import { adminStatsCache as cache } from "@/data/stats/_utils/admin-stats-cache";
import { prisma } from "@zoonk/db";

export const getPeriodAccuracyRate = cache(async (start: Date, end: Date) => {
  const [total, correct] = await Promise.all([
    prisma.stepAttempt.count({ where: { answeredAt: { gte: start, lte: end } } }),
    prisma.stepAttempt.count({ where: { answeredAt: { gte: start, lte: end }, isCorrect: true } }),
  ]);

  return total === 0 ? 0 : (correct / total) * 100;
});
