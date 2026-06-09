import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserSql } from "@/data/stats/_utils/analytics-user-filter";
import { prisma } from "@zoonk/db";

export const getAvgLessonsPerLearner = cacheAdminData(async () => {
  const result = await prisma.$queryRaw<[{ total: bigint; learners: bigint }]>`
    SELECT
      COUNT(*) as total,
      COUNT(DISTINCT user_id) as learners
    FROM lesson_progress
    JOIN users ON users.id = lesson_progress.user_id
    WHERE ${trackedAnalyticsUserSql} AND completed_at IS NOT NULL
  `;

  const total = Number(result[0].total);
  const learners = Number(result[0].learners);

  return learners === 0 ? 0 : Math.round((total / learners) * 10) / 10;
});
