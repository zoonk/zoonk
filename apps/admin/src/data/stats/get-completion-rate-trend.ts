import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserSql } from "@/data/stats/_utils/analytics-user-filter";
import { type RateTrendRow, toRateTrendPoint } from "@/data/stats/_utils/rate-trend";
import { getStatsDateBucketSql } from "@/data/stats/_utils/stats-date-bucket";
import { prisma, sql } from "@zoonk/db";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";

/**
 * Groups lessons by when learners started them and measures the completed
 * share in each bucket. This preserves the existing completion-rate definition
 * while making changes across the selected period visible.
 */
export const getCompletionRateTrend = cacheAdminData(
  async (start: Date, end: Date, period: HistoryPeriod) => {
    const dateBucketSql = getStatsDateBucketSql({ date: sql`lesson_progress.started_at`, period });

    const results = await prisma.$queryRaw<RateTrendRow[]>`
      SELECT
        ${dateBucketSql} AS date,
        COUNT(*) FILTER (WHERE lesson_progress.completed_at IS NOT NULL) AS numerator,
        COUNT(*) AS denominator
      FROM lesson_progress
      JOIN users ON users.id = lesson_progress.user_id
      WHERE
        ${trackedAnalyticsUserSql}
        AND lesson_progress.started_at >= ${start}
        AND lesson_progress.started_at <= ${end}
      GROUP BY ${dateBucketSql}
      ORDER BY ${dateBucketSql} ASC
    `;

    return results.map((row) => toRateTrendPoint(row));
  },
);
