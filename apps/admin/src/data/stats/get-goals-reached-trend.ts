import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import {
  trackedAnalyticsUserRelationWhere,
  trackedAnalyticsUserSql,
} from "@/data/stats/_utils/analytics-user-filter";
import { getStatsDateBucketSql } from "@/data/stats/_utils/stats-date-bucket";
import { prisma, sql } from "@zoonk/db";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";

/**
 * Goals marked completed per bucket. Goals store no completion date, so a reached goal is dated
 * by its last update, which is when its status changed unless it was edited afterwards.
 */
export const getGoalsReachedTrend = cacheAdminData(
  async (start: Date, end: Date, period: HistoryPeriod) => {
    const dateBucketSql = getStatsDateBucketSql({ date: sql`goals.updated_at`, period });

    const rows = await prisma.$queryRaw<{ count: number; date: Date }[]>`
      SELECT ${dateBucketSql} AS date, COUNT(*)::int AS count
      FROM goals
      JOIN users ON users.id = goals.user_id
      WHERE
        ${trackedAnalyticsUserSql}
        AND goals.status = 'completed'
        AND goals.updated_at >= ${start}
        AND goals.updated_at <= ${end}
      GROUP BY ${dateBucketSql}
      ORDER BY ${dateBucketSql} ASC
    `;

    return rows;
  },
);

/** All goals of tracked learners by their current status. */
export const countGoalsByStatus = cacheAdminData(async () => {
  const rows = await prisma.goal.groupBy({
    _count: { status: true },
    by: ["status"],
    orderBy: { status: "asc" },
    where: trackedAnalyticsUserRelationWhere,
  });

  return rows.map((row) => ({ count: row._count.status, status: row.status }));
});
