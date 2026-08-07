import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserSql } from "@/data/stats/_utils/analytics-user-filter";
import { type RateTrendRow, toRateTrendPoint } from "@/data/stats/_utils/rate-trend";
import { getStatsDateBucketSql } from "@/data/stats/_utils/stats-date-bucket";
import { prisma, sql } from "@zoonk/db";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";

/**
 * Groups signups into the visible chart buckets and shows what share of each
 * signup cohort currently has an active paid plan. Deduplicating paid users in
 * the CTE prevents multiple subscription records from inflating conversion.
 */
export const getConversionRateTrend = cacheAdminData(
  async (start: Date, end: Date, period: HistoryPeriod) => {
    const dateBucketSql = getStatsDateBucketSql({ date: sql`users.created_at`, period });

    const results = await prisma.$queryRaw<RateTrendRow[]>`
      WITH paid_users AS (
        SELECT DISTINCT subscriptions.reference_id AS user_id
        FROM subscriptions
        WHERE subscriptions.plan != 'free' AND subscriptions.status = 'active'
      )
      SELECT
        ${dateBucketSql} AS date,
        COUNT(paid_users.user_id) AS numerator,
        COUNT(users.id) AS denominator
      FROM users
      LEFT JOIN paid_users ON paid_users.user_id = users.id
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
