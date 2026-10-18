import { completedLessonActivitySql } from "@/data/stats/_utils/analytics-user-filter";
import { type Sql, sql } from "@zoonk/db";

/** Today's UTC date, the last day a period or cohort can have activity for. */
export const utcTodaySql = sql`(NOW() AT TIME ZONE 'UTC')::date`;

/**
 * Learner-local days with a finished learning activity, as distinct `user_id` and `activity_date`
 * rows: a closed ledger row, or a daily row with answers, time or a finished lesson (legacy days
 * the learning v2 migration recovered only have the last). It reads learner-owned rows only;
 * callers join `users` to leave out learners who turned analytics off.
 */
export function getLearnerActivityDaysSql({ end, start }: { end: Date; start: Date }): Sql {
  return sql`
    SELECT learning_events.user_id, learning_events.local_date AS activity_date
    FROM learning_events
    WHERE
      learning_events.ended_at IS NOT NULL
      AND learning_events.local_date >= ${start}::date
      AND learning_events.local_date <= ${end}::date

    UNION

    SELECT daily_progress.user_id, daily_progress.date AS activity_date
    FROM daily_progress
    WHERE
      (
        ${completedLessonActivitySql}
        OR daily_progress.time_spent_seconds > 0
        OR daily_progress.correct_answers + daily_progress.incorrect_answers > 0
      )
      AND daily_progress.date >= ${start}::date
      AND daily_progress.date <= ${end}::date
  `;
}

/**
 * Per-learner D1, D7 and D30 retention: whether the learner was active exactly that many days
 * after signing up, and whether that day has passed yet (eligible). It reads the CTEs `cohort`
 * (`user_id`, `signup_date`) and `activity` (`user_id`, `activity_date`) of the calling query.
 */
export const learnerRetentionSql = sql`
  SELECT
    cohort.user_id,
    cohort.signup_date + 1 <= ${utcTodaySql} AS d1_eligible,
    cohort.signup_date + 7 <= ${utcTodaySql} AS d7_eligible,
    cohort.signup_date + 30 <= ${utcTodaySql} AS d30_eligible,
    COALESCE(BOOL_OR(activity.activity_date = cohort.signup_date + 1), FALSE) AS d1_retained,
    COALESCE(BOOL_OR(activity.activity_date = cohort.signup_date + 7), FALSE) AS d7_retained,
    COALESCE(BOOL_OR(activity.activity_date = cohort.signup_date + 30), FALSE) AS d30_retained
  FROM cohort
  LEFT JOIN activity ON activity.user_id = cohort.user_id
  GROUP BY cohort.user_id, cohort.signup_date
`;
