import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserSql } from "@/data/stats/_utils/analytics-user-filter";
import { getStatsDateBucketSql } from "@/data/stats/_utils/stats-date-bucket";
import { timedLessonSql } from "@/data/stats/_utils/timed-lesson";
import { prisma, sql } from "@zoonk/db";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";

/**
 * Averages finished lesson durations inside each visible bucket so changes in
 * lesson pace can be read without mixing unfinished lessons into the series.
 */
export const getAvgLessonTimeTrend = cacheAdminData(
  async (start: Date, end: Date, period: HistoryPeriod) => {
    const dateBucketSql = getStatsDateBucketSql({ date: sql`learning_events.ended_at`, period });

    const results = await prisma.$queryRaw<{ count: number; date: Date }[]>`
      SELECT
        ${dateBucketSql} AS date,
        AVG(learning_events.seconds)::float AS count
      FROM learning_events
      JOIN users ON users.id = learning_events.user_id
      WHERE
        ${trackedAnalyticsUserSql}
        AND ${timedLessonSql}
        AND learning_events.ended_at >= ${start}
        AND learning_events.ended_at <= ${end}
      GROUP BY ${dateBucketSql}
      ORDER BY ${dateBucketSql} ASC
    `;

    return results;
  },
);
