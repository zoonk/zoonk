import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserSql } from "@/data/stats/_utils/analytics-user-filter";
import { getStatsDateBucketSql } from "@/data/stats/_utils/stats-date-bucket";
import { prisma, sql } from "@zoonk/db";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";

type DailyGoalTrendRow = {
  date: Date;
  days: number;
  goalSeconds: number;
  met: number;
  studiedSeconds: number;
};

/**
 * Days learners studied, from their first goal on, against the daily minutes of their active
 * goals (a learner's budget is split across goals, so their minutes add up). Goals keep no
 * history, so every day is measured against today's minutes.
 */
export const getDailyGoalTrend = cacheAdminData(
  async (start: Date, end: Date, period: HistoryPeriod) => {
    const dateBucketSql = getStatsDateBucketSql({ date: sql`daily_progress.date`, period });

    return prisma.$queryRaw<DailyGoalTrendRow[]>`
      WITH goal_minutes AS (
        SELECT
          goals.user_id,
          SUM(goals.daily_minutes) FILTER (WHERE goals.status = 'active') AS minutes,
          MIN(goals.created_at)::date AS since
        FROM goals
        GROUP BY goals.user_id
      )
      SELECT
        ${dateBucketSql} AS date,
        COUNT(*)::int AS days,
        COUNT(*) FILTER (
          WHERE daily_progress.time_spent_seconds >= goal_minutes.minutes * 60
        )::int AS met,
        SUM(daily_progress.time_spent_seconds)::float AS "studiedSeconds",
        SUM(goal_minutes.minutes * 60)::float AS "goalSeconds"
      FROM daily_progress
      JOIN goal_minutes ON goal_minutes.user_id = daily_progress.user_id
      JOIN users ON users.id = daily_progress.user_id
      WHERE
        ${trackedAnalyticsUserSql}
        AND goal_minutes.minutes > 0
        AND daily_progress.date >= goal_minutes.since
        AND daily_progress.time_spent_seconds > 0
        AND daily_progress.date >= ${start}::date
        AND daily_progress.date <= ${end}::date
      GROUP BY ${dateBucketSql}
      ORDER BY ${dateBucketSql} ASC
    `;
  },
);
