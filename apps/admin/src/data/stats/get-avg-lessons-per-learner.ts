import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserSql } from "@/data/stats/_utils/analytics-user-filter";
import { prisma } from "@zoonk/db";

/** First lesson completions per learner who finished at least one lesson, from the daily totals. */
export const getAvgLessonsPerLearner = cacheAdminData(async () => {
  const result = await prisma.$queryRaw<[{ total: bigint | null; learners: bigint }]>`
    SELECT
      SUM(lessons_completed) as total,
      COUNT(DISTINCT user_id) as learners
    FROM daily_progress
    JOIN users ON users.id = daily_progress.user_id
    WHERE ${trackedAnalyticsUserSql} AND lessons_completed > 0
  `;

  const total = Number(result[0].total ?? 0n);
  const learners = Number(result[0].learners);

  return learners === 0 ? 0 : Math.round((total / learners) * 10) / 10;
});
