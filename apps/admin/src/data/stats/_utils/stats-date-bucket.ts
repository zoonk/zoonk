import { type Sql, sql } from "@zoonk/db";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";

export function getStatsDateBucketSql({ date, period }: { date: Sql; period: HistoryPeriod }): Sql {
  if (period === "all") {
    return sql`DATE_TRUNC('year', ${date})::date`;
  }

  if (period === "year") {
    return sql`DATE_TRUNC('month', ${date})::date`;
  }

  return sql`${date}::date`;
}
