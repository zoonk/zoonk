import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserSql } from "@/data/stats/_utils/analytics-user-filter";
import { getStatsDateBucketSql } from "@/data/stats/_utils/stats-date-bucket";
import { prisma, sql } from "@zoonk/db";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";

/**
 * Averages completed lesson durations inside each visible bucket so changes in
 * lesson pace can be read without mixing unfinished lessons into the series.
 */
export const getAvgLessonTimeTrend = cacheAdminData(
  async (start: Date, end: Date, period: HistoryPeriod) => {
    const dateBucketSql = getStatsDateBucketSql({
      date: sql`lesson_progress.completed_at`,
      period,
    });

    const results = await prisma.$queryRaw<{ count: number; date: Date }[]>`
      SELECT
        ${dateBucketSql} AS date,
        AVG(lesson_progress.duration_seconds)::float AS count
      FROM lesson_progress
      JOIN users ON users.id = lesson_progress.user_id
      WHERE
        ${trackedAnalyticsUserSql}
        AND lesson_progress.completed_at >= ${start}
        AND lesson_progress.completed_at <= ${end}
        AND lesson_progress.duration_seconds IS NOT NULL
      GROUP BY ${dateBucketSql}
      ORDER BY ${dateBucketSql} ASC
    `;

    return results;
  },
);
