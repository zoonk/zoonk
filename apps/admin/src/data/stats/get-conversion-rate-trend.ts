import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserSql } from "@/data/stats/_utils/analytics-user-filter";
import { getActivePaidSubscriptionAtSql } from "@/data/stats/_utils/paid-subscription-overlap";
import { type RateTrendRow, toRateTrendPoint } from "@/data/stats/_utils/rate-trend";
import { type Sql, prisma, sql } from "@zoonk/db";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";

/**
 * Creates the same daily, monthly, or yearly bucket boundaries used by the
 * visible chart. Each bucket exposes its final instant so the numerator can
 * measure the active subscriber stock after that bucket's additions and churn.
 */
function getConversionBucketSeriesSql({
  end,
  period,
  start,
}: {
  end: Date;
  period: HistoryPeriod;
  start: Date;
}): Sql {
  if (period === "all") {
    return sql`
      SELECT
        series.bucket_start,
        LEAST(series.bucket_start + INTERVAL '1 year' - INTERVAL '1 millisecond', ${end}) AS bucket_end
      FROM GENERATE_SERIES(
        DATE_TRUNC('year', ${start}::timestamp),
        DATE_TRUNC('year', ${end}::timestamp),
        INTERVAL '1 year'
      ) AS series(bucket_start)
    `;
  }

  if (period === "year") {
    return sql`
      SELECT
        series.bucket_start,
        LEAST(series.bucket_start + INTERVAL '1 month' - INTERVAL '1 millisecond', ${end}) AS bucket_end
      FROM GENERATE_SERIES(
        DATE_TRUNC('month', ${start}::timestamp),
        DATE_TRUNC('month', ${end}::timestamp),
        INTERVAL '1 month'
      ) AS series(bucket_start)
    `;
  }

  return sql`
    SELECT
      series.bucket_start,
      LEAST(series.bucket_start + INTERVAL '1 day' - INTERVAL '1 millisecond', ${end}) AS bucket_end
    FROM GENERATE_SERIES(
      DATE_TRUNC('day', ${start}::timestamp),
      DATE_TRUNC('day', ${end}::timestamp),
      INTERVAL '1 day'
    ) AS series(bucket_start)
  `;
}

/**
 * A bucket before the first tracked learner has no conversion rate. Omitting
 * it lets the chart completion step render a gap, while a bucket with learners
 * and no paid access still remains an honest 0% value.
 */
function hasConversionDenominator(row: RateTrendRow): boolean {
  return row.denominator > BigInt(0);
}

/**
 * Shows the active paid share at the end of each visible bucket. The numerator
 * is a point-in-time subscriber stock while the denominator is the cumulative
 * tracked learner population at the same instant.
 */
export const getConversionRateTrend = cacheAdminData(
  async (start: Date, end: Date, period: HistoryPeriod) => {
    const bucketSeriesSql = getConversionBucketSeriesSql({ end, period, start });

    const activePaidSubscriptionSql = getActivePaidSubscriptionAtSql({
      pointInTime: sql`buckets.bucket_end`,
    });

    const results = await prisma.$queryRaw<RateTrendRow[]>`
      WITH buckets AS (
        ${bucketSeriesSql}
      )
      SELECT
        buckets.bucket_start::date AS date,
        (
          SELECT COUNT(DISTINCT subscriptions.reference_id)
          FROM subscriptions
          JOIN users ON users.id = subscriptions.reference_id
          WHERE
            ${trackedAnalyticsUserSql}
            AND users.created_at <= buckets.bucket_end
            AND ${activePaidSubscriptionSql}
        ) AS numerator,
        (
          SELECT COUNT(*)
          FROM users
          WHERE ${trackedAnalyticsUserSql} AND users.created_at <= buckets.bucket_end
        ) AS denominator
      FROM buckets
      ORDER BY buckets.bucket_start ASC
    `;

    return results
      .filter((row) => hasConversionDenominator(row))
      .map((row) => toRateTrendPoint(row));
  },
);
