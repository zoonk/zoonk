import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserSql } from "@/data/stats/_utils/analytics-user-filter";
import { getLearnerActivityDaysSql, utcTodaySql } from "@/data/stats/_utils/learner-activity";
import { getStatsDateBucketSql } from "@/data/stats/_utils/stats-date-bucket";
import { type Sql, prisma, sql } from "@zoonk/db";
import { type HistoryPeriod } from "@zoonk/utils/date-ranges";

/** A rolling week is the day itself and the six days before it. */
const EARLIER_DAYS_IN_WEEK = 6;
const MILLISECONDS_PER_DAY = 86_400 * 1000;

type ActiveLearnerRhythm = { daily: number | null; weekly: number | null };

/**
 * One row per day from the first activity (or the period start) to today: learners active that
 * day and learners active in the rolling week ending that day. Days before anyone was active are
 * left out, so an all-time average isn't diluted by the months before launch.
 */
function getRhythmSeriesSql({ end, start }: { end: Date; start: Date }): Sql {
  const activityStart = new Date(start.getTime() - EARLIER_DAYS_IN_WEEK * MILLISECONDS_PER_DAY);

  return sql`
    WITH activity AS (
      SELECT days.user_id, days.activity_date
      FROM (${getLearnerActivityDaysSql({ end, start: activityStart })}) days
      JOIN users ON users.id = days.user_id
      WHERE ${trackedAnalyticsUserSql}
    ),
    series AS (
      SELECT GENERATE_SERIES(
        GREATEST(${start}::date, (SELECT MIN(activity.activity_date) FROM activity)),
        LEAST(${end}::date, ${utcTodaySql}),
        INTERVAL '1 day'
      )::date AS day
    )
    SELECT
      series.day,
      COUNT(DISTINCT activity.user_id) FILTER (WHERE activity.activity_date = series.day) AS daily,
      COUNT(DISTINCT activity.user_id) AS weekly
    FROM series
    LEFT JOIN activity
      ON activity.activity_date BETWEEN series.day - ${EARLIER_DAYS_IN_WEEK}::int AND series.day
    GROUP BY series.day
  `;
}

/** Average daily and rolling-weekly active learners across the days of a period. */
export const getActiveLearnerAverages = cacheAdminData(async (start: Date, end: Date) => {
  const [averages] = await prisma.$queryRaw<[ActiveLearnerRhythm]>`
    SELECT AVG(rhythm.daily)::float AS daily, AVG(rhythm.weekly)::float AS weekly
    FROM (${getRhythmSeriesSql({ end, start })}) rhythm
  `;

  return { daily: averages.daily ?? 0, weekly: averages.weekly ?? 0 };
});

/** The same daily values averaged inside each visible chart bucket. */
export const getActiveLearnerRhythmTrend = cacheAdminData(
  async (start: Date, end: Date, period: HistoryPeriod) => {
    const dateBucketSql = getStatsDateBucketSql({ date: sql`rhythm.day`, period });

    return prisma.$queryRaw<(ActiveLearnerRhythm & { date: Date })[]>`
      SELECT
        ${dateBucketSql} AS date,
        AVG(rhythm.daily)::float AS daily,
        AVG(rhythm.weekly)::float AS weekly
      FROM (${getRhythmSeriesSql({ end, start })}) rhythm
      GROUP BY ${dateBucketSql}
      ORDER BY ${dateBucketSql} ASC
    `;
  },
);
