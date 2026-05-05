import "server-only";
import { adminStatsCache as cache } from "@/data/stats/_utils/admin-stats-cache";
import { prisma } from "@zoonk/db";

export const getCompletionRate = cache(async () => {
  const [started, completed] = await Promise.all([
    prisma.lessonProgress.count(),
    prisma.lessonProgress.count({ where: { completedAt: { not: null } } }),
  ]);

  return started === 0 ? 0 : (completed / started) * 100;
});
