import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

export const getAccuracyRate = cacheAdminData(async () => {
  const [total, correct] = await Promise.all([
    prisma.stepAttempt.count(),
    prisma.stepAttempt.count({ where: { isCorrect: true } }),
  ]);

  return total === 0 ? 0 : (correct / total) * 100;
});
