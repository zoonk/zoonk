import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserSql } from "@/data/stats/_utils/analytics-user-filter";
import { getStatsDateBucketSql } from "@/data/stats/_utils/stats-date-bucket";
import { prisma, sql } from "@zoonk/db";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";

/**
 * Sums recorded learning time inside each visible bucket so the trend remains
 * additive when the page moves from daily to monthly or yearly views.
 */
export const getLearningTimeTrend = cacheAdminData(
  async (start: Date, end: Date, period: HistoryPeriod) => {
    const dateBucketSql = getStatsDateBucketSql({ date: sql`daily_progress.date`, period });

    const results = await prisma.$queryRaw<{ count: bigint; date: Date }[]>`
      SELECT
        ${dateBucketSql} AS date,
        SUM(daily_progress.time_spent_seconds) AS count
      FROM daily_progress
      JOIN users ON users.id = daily_progress.user_id
      WHERE
        ${trackedAnalyticsUserSql}
        AND daily_progress.date >= ${start}
        AND daily_progress.date <= ${end}
      GROUP BY ${dateBucketSql}
      ORDER BY ${dateBucketSql} ASC
    `;

    return results.map((row) => ({ count: Number(row.count), date: row.date }));
  },
);
