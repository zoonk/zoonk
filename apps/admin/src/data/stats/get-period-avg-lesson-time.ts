import "server-only";
import { adminStatsCache as cache } from "@/data/stats/_utils/admin-stats-cache";
import { prisma } from "@zoonk/db";

export const getPeriodAvgLessonTime = cache(async (start: Date, end: Date) => {
  const result = await prisma.lessonProgress.aggregate({
    _avg: { durationSeconds: true },
    where: { completedAt: { gte: start, lte: end }, durationSeconds: { not: null } },
  });

  return result._avg.durationSeconds ?? 0;
});
