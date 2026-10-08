import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserSql } from "@/data/stats/_utils/analytics-user-filter";
import { type RateTrendRow, toRateTrendPoint } from "@/data/stats/_utils/rate-trend";
import { getStatsDateBucketSql } from "@/data/stats/_utils/stats-date-bucket";
import { prisma, sql } from "@zoonk/db";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";

/**
 * Groups lessons by when learners started them and measures the finished
 * share in each bucket, reading the learning ledger so the trend survives
 * lessons being deleted.
 */
export const getCompletionRateTrend = cacheAdminData(
  async (start: Date, end: Date, period: HistoryPeriod) => {
    const dateBucketSql = getStatsDateBucketSql({ date: sql`learning_events.started_at`, period });

    const results = await prisma.$queryRaw<RateTrendRow[]>`
      SELECT
        ${dateBucketSql} AS date,
        COUNT(*) FILTER (WHERE learning_events.ended_at IS NOT NULL) AS numerator,
        COUNT(*) AS denominator
      FROM learning_events
      JOIN users ON users.id = learning_events.user_id
      WHERE
        ${trackedAnalyticsUserSql}
        AND learning_events.kind = 'lesson'
        AND learning_events.started_at >= ${start}
        AND learning_events.started_at <= ${end}
      GROUP BY ${dateBucketSql}
      ORDER BY ${dateBucketSql} ASC
    `;

    return results.map((row) => toRateTrendPoint(row));
  },
);
