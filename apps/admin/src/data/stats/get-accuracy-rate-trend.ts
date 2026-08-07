import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserSql } from "@/data/stats/_utils/analytics-user-filter";
import { type RateTrendRow, toRateTrendPoint } from "@/data/stats/_utils/rate-trend";
import { getStatsDateBucketSql } from "@/data/stats/_utils/stats-date-bucket";
import { prisma, sql } from "@zoonk/db";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";

/**
 * Calculates answer accuracy inside each visible time bucket so the chart
 * reflects the same correct-attempt share as the selected-period headline.
 */
export const getAccuracyRateTrend = cacheAdminData(
  async (start: Date, end: Date, period: HistoryPeriod) => {
    const dateBucketSql = getStatsDateBucketSql({ date: sql`step_attempts.answered_at`, period });

    const results = await prisma.$queryRaw<RateTrendRow[]>`
      SELECT
        ${dateBucketSql} AS date,
        COUNT(*) FILTER (WHERE step_attempts.is_correct = TRUE) AS numerator,
        COUNT(*) AS denominator
      FROM step_attempts
      JOIN users ON users.id = step_attempts.user_id
      WHERE
        ${trackedAnalyticsUserSql}
        AND step_attempts.answered_at >= ${start}
        AND step_attempts.answered_at <= ${end}
      GROUP BY ${dateBucketSql}
      ORDER BY ${dateBucketSql} ASC
    `;

    return results.map((row) => toRateTrendPoint(row));
  },
);
