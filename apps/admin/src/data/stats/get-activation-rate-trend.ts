import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserSql } from "@/data/stats/_utils/analytics-user-filter";
import { type RateTrendRow, toRateTrendPoint } from "@/data/stats/_utils/rate-trend";
import { getStatsDateBucketSql } from "@/data/stats/_utils/stats-date-bucket";
import { prisma, sql } from "@zoonk/db";
import { BRAIN_POWER_PER_LESSON } from "@zoonk/utils/brain-power";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";

/**
 * Groups signups into the visible chart buckets and shows what share of each
 * signup cohort has completed a lesson. The durable Brain Power threshold
 * matches the headline activation metric even when lesson progress is reset.
 */
export const getActivationRateTrend = cacheAdminData(
  async (start: Date, end: Date, period: HistoryPeriod) => {
    const dateBucketSql = getStatsDateBucketSql({ date: sql`users.created_at`, period });

    const results = await prisma.$queryRaw<RateTrendRow[]>`
      SELECT
        ${dateBucketSql} AS date,
        COUNT(*) FILTER (
          WHERE user_progress.total_brain_power >= ${BRAIN_POWER_PER_LESSON}
        ) AS numerator,
        COUNT(*) AS denominator
      FROM users
      LEFT JOIN user_progress ON user_progress.user_id = users.id
      WHERE
        ${trackedAnalyticsUserSql}
        AND users.created_at >= ${start}
        AND users.created_at <= ${end}
      GROUP BY ${dateBucketSql}
      ORDER BY ${dateBucketSql} ASC
    `;

    return results.map((row) => toRateTrendPoint(row));
  },
);
