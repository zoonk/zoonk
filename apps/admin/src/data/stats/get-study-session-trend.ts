import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserSql } from "@/data/stats/_utils/analytics-user-filter";
import { getStatsDateBucketSql } from "@/data/stats/_utils/stats-date-bucket";
import { prisma, sql } from "@zoonk/db";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";

/**
 * Study sessions started and finished per bucket of their learner-local date. A session is
 * started once its first block starts and finished when every block is done or skipped.
 */
export const getStudySessionTrend = cacheAdminData(
  async (start: Date, end: Date, period: HistoryPeriod) => {
    const dateBucketSql = getStatsDateBucketSql({ date: sql`study_sessions.local_date`, period });

    return prisma.$queryRaw<{ completed: number; date: Date; started: number }[]>`
      SELECT
        ${dateBucketSql} AS date,
        COUNT(*) FILTER (
          WHERE study_sessions.started_at IS NOT NULL OR study_sessions.status = 'completed'
        )::int AS started,
        COUNT(*) FILTER (WHERE study_sessions.status = 'completed')::int AS completed
      FROM study_sessions
      JOIN users ON users.id = study_sessions.user_id
      WHERE
        ${trackedAnalyticsUserSql}
        AND study_sessions.local_date >= ${start}::date
        AND study_sessions.local_date <= ${end}::date
      GROUP BY ${dateBucketSql}
      ORDER BY ${dateBucketSql} ASC
    `;
  },
);
