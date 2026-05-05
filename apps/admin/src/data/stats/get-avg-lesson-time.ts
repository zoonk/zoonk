import "server-only";
import { adminStatsCache as cache } from "@/data/stats/_utils/admin-stats-cache";
import { prisma } from "@zoonk/db";

export const getAvgLessonTime = cache(async () => {
  const result = await prisma.lessonProgress.aggregate({
    _avg: { durationSeconds: true },
    where: { durationSeconds: { not: null } },
  });

  return result._avg.durationSeconds ?? 0;
});
