import "server-only";
import { adminStatsCache as cache } from "@/data/stats/_utils/admin-stats-cache";
import { prisma } from "@zoonk/db";

export const getAvgLessonsPerLearner = cache(async () => {
  const result = await prisma.$queryRaw<[{ total: bigint; learners: bigint }]>`
    SELECT
      COUNT(*) as total,
      COUNT(DISTINCT user_id) as learners
    FROM lesson_progress
    WHERE completed_at IS NOT NULL
  `;

  const total = Number(result[0].total);
  const learners = Number(result[0].learners);

  return learners === 0 ? 0 : Math.round((total / learners) * 10) / 10;
});
