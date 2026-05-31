import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

export const getPeriodAccuracyRate = cacheAdminData(async (start: Date, end: Date) => {
  const [total, correct] = await Promise.all([
    prisma.stepAttempt.count({ where: { answeredAt: { gte: start, lte: end } } }),
    prisma.stepAttempt.count({ where: { answeredAt: { gte: start, lte: end }, isCorrect: true } }),
  ]);

  return total === 0 ? 0 : (correct / total) * 100;
});
