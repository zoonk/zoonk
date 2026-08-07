import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import {
  completedLessonActivitySql,
  trackedAnalyticsUserSql,
} from "@/data/stats/_utils/analytics-user-filter";
import { getStatsDateBucketSql } from "@/data/stats/_utils/stats-date-bucket";
import { prisma, sql } from "@zoonk/db";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";

/**
 * Returns distinct active learners for each visible chart bucket. The wrapped
 * function keeps positional arguments because React cache compares argument
 * identity, while the Date objects already come from the shared stats range.
 */
export const getActiveLearnerTrend = cacheAdminData(
  async (start: Date, end: Date, period: HistoryPeriod) => {
    const dateBucketSql = getStatsDateBucketSql({ date: sql`daily_progress.date`, period });

    const results = await prisma.$queryRaw<{ date: Date; count: bigint }[]>`
    SELECT ${dateBucketSql} AS date, COUNT(DISTINCT user_id) as count
    FROM daily_progress
    JOIN users ON users.id = daily_progress.user_id
    WHERE
      ${trackedAnalyticsUserSql}
      AND ${completedLessonActivitySql}
      AND date >= ${start}
      AND date <= ${end}
    GROUP BY ${dateBucketSql}
    ORDER BY ${dateBucketSql} ASC
  `;

    return results.map((row) => ({ count: Number(row.count), date: row.date }));
  },
);
