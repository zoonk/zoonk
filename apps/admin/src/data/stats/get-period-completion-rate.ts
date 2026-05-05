import "server-only";
import { adminStatsCache as cache } from "@/data/stats/_utils/admin-stats-cache";
import { prisma } from "@zoonk/db";

export const getPeriodCompletionRate = cache(async (start: Date, end: Date) => {
  const where = { startedAt: { gte: start, lte: end } };

  const [started, completed] = await Promise.all([
    prisma.lessonProgress.count({ where }),
    prisma.lessonProgress.count({ where: { ...where, completedAt: { not: null } } }),
  ]);

  return started === 0 ? 0 : (completed / started) * 100;
});
