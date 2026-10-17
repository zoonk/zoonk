import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { trackedAnalyticsUserSql } from "@/data/stats/_utils/analytics-user-filter";
import {
  getLearnerActivityDaysSql,
  learnerRetentionSql,
} from "@/data/stats/_utils/learner-activity";
import { prisma } from "@zoonk/db";

export type SignupRetentionRow = {
  d1Eligible: number;
  d1Retained: number;
  d7Eligible: number;
  d7Retained: number;
  d30Eligible: number;
  d30Retained: number;
  signups: number;
  signupWeek: Date;
};

/**
 * D1, D7 and D30 retention of each signup week in the period, newest first. A learner counts for a
 * day only once that day has passed, so young cohorts aren't shown as churned.
 */
export const getSignupRetention = cacheAdminData(
  async (start: Date, end: Date) =>
    prisma.$queryRaw<SignupRetentionRow[]>`
    WITH cohort AS (
      SELECT
        users.id AS user_id,
        users.created_at::date AS signup_date,
        DATE_TRUNC('week', users.created_at)::date AS signup_week
      FROM users
      WHERE ${trackedAnalyticsUserSql} AND users.created_at >= ${start} AND users.created_at <= ${end}
    ),
    activity AS (
      SELECT days.user_id, days.activity_date
      FROM (${getLearnerActivityDaysSql({ end: new Date(), start })}) days
      WHERE days.user_id IN (SELECT cohort.user_id FROM cohort)
    ),
    retention AS (${learnerRetentionSql})
    SELECT
      cohort.signup_week AS "signupWeek",
      COUNT(*)::int AS signups,
      COUNT(*) FILTER (WHERE retention.d1_eligible)::int AS "d1Eligible",
      COUNT(*) FILTER (WHERE retention.d1_eligible AND retention.d1_retained)::int AS "d1Retained",
      COUNT(*) FILTER (WHERE retention.d7_eligible)::int AS "d7Eligible",
      COUNT(*) FILTER (WHERE retention.d7_eligible AND retention.d7_retained)::int AS "d7Retained",
      COUNT(*) FILTER (WHERE retention.d30_eligible)::int AS "d30Eligible",
      COUNT(*) FILTER (WHERE retention.d30_eligible AND retention.d30_retained)::int AS "d30Retained"
    FROM cohort
    JOIN retention ON retention.user_id = cohort.user_id
    GROUP BY cohort.signup_week
    ORDER BY cohort.signup_week DESC
  `,
);
