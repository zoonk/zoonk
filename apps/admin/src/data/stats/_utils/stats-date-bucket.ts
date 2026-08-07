import { type Sql, sql } from "@zoonk/db";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";

/**
 * Uses the same database bucket for every admin trend so charts on one page
 * align to daily, weekly, monthly, or yearly intervals as the selected period
 * grows. Keeping this rule beside the queries prevents individual metrics from
 * drifting onto incompatible time axes.
 */
export function getStatsDateBucketSql({ date, period }: { date: Sql; period: HistoryPeriod }): Sql {
  if (period === "all") {
    return sql`DATE_TRUNC('year', ${date})::date`;
  }

  if (period === "year") {
    return sql`DATE_TRUNC('month', ${date})::date`;
  }

  if (period === "6months") {
    return sql`DATE_TRUNC('week', ${date})::date`;
  }

  return sql`${date}::date`;
}
