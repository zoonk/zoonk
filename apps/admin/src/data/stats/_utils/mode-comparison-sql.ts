import { trackedAnalyticsUserSql } from "@/data/stats/_utils/analytics-user-filter";
import { utcTodaySql } from "@/data/stats/_utils/learner-activity";
import { type Sql, sql } from "@zoonk/db";

/**
 * Age bands the plan compares, from the birth month and year the profile keeps (a missing month
 * counts as January).
 */
const ageBandSql = sql`
  CASE
    WHEN age.years IS NULL THEN 'unknown'
    WHEN age.years < 13 THEN 'under 13'
    WHEN age.years < 16 THEN '13-15'
    WHEN age.years < 18 THEN '16-17'
    WHEN age.years < 25 THEN '18-24'
    ELSE '25+'
  END
`;

/**
 * The CTE `learners`: tracked learners who signed up in the period and have a learning profile
 * (so they went through v2 onboarding), with their mode and strata: the active goal's kind and
 * language, age band and signup week. Learners without an active goal form their own `none`
 * stratum. Platform isn't stored in the database, so it can't be matched here.
 */
export function getModeLearnersSql({ end, start }: { end: Date; start: Date }): Sql {
  return sql`
    learners AS (
      SELECT
        users.id AS user_id,
        users.created_at::date AS signup_date,
        DATE_TRUNC('week', users.created_at)::date AS signup_week,
        profiles.experience_mode::text AS mode,
        COALESCE(goals.kind::text, 'none') AS goal_kind,
        COALESCE(goals.language, 'unknown') AS locale,
        ${ageBandSql} AS age_band
      FROM users
      JOIN user_learning_profiles profiles ON profiles.user_id = users.id
      LEFT JOIN goals ON goals.id = profiles.active_goal_id
      CROSS JOIN LATERAL (
        SELECT DATE_PART(
          'year',
          AGE(${utcTodaySql}, MAKE_DATE(profiles.birth_year, COALESCE(profiles.birth_month, 1), 1))
        ) AS years
      ) age
      WHERE
        ${trackedAnalyticsUserSql}
        AND users.created_at >= ${start}
        AND users.created_at <= ${end}
    )
  `;
}

/**
 * Per-learner totals read from learner-owned rows only: active days since signup, sessions, study time,
 * answers on a skill last answered 7 or more days earlier, mastered skills and an active paid
 * subscription. They read the CTEs `learners` and `activity` of the calling query.
 */
export const modeLearnerTotalsSql = sql`
  active_days AS (
    SELECT activity.user_id, COUNT(*) AS days
    FROM activity
    JOIN learners ON learners.user_id = activity.user_id
    WHERE activity.activity_date >= learners.signup_date
    GROUP BY activity.user_id
  ),
  sessions AS (
    SELECT
      study_sessions.user_id,
      COUNT(*) FILTER (
        WHERE study_sessions.started_at IS NOT NULL OR study_sessions.status = 'completed'
      ) AS started,
      COUNT(*) FILTER (WHERE study_sessions.status = 'completed') AS completed
    FROM study_sessions
    WHERE study_sessions.user_id IN (SELECT learners.user_id FROM learners)
    GROUP BY study_sessions.user_id
  ),
  study_time AS (
    SELECT
      daily_progress.user_id,
      SUM(daily_progress.time_spent_seconds) AS seconds,
      COUNT(*) FILTER (WHERE daily_progress.time_spent_seconds > 0) AS days
    FROM daily_progress
    WHERE daily_progress.user_id IN (SELECT learners.user_id FROM learners)
    GROUP BY daily_progress.user_id
  ),
  skill_answers AS (
    SELECT
      attempts.user_id,
      attempts.is_correct,
      attempts.answered_at - LAG(attempts.answered_at) OVER (
        PARTITION BY attempts.user_id, attempts.skill_id
        ORDER BY attempts.answered_at
      ) AS gap
    FROM attempts
    WHERE
      attempts.skill_id IS NOT NULL
      AND attempts.user_id IN (SELECT learners.user_id FROM learners)
  ),
  spaced_answers AS (
    SELECT
      skill_answers.user_id,
      COUNT(*) AS answers,
      COUNT(*) FILTER (WHERE skill_answers.is_correct) AS correct
    FROM skill_answers
    WHERE skill_answers.gap >= INTERVAL '7 days'
    GROUP BY skill_answers.user_id
  ),
  mastered AS (
    SELECT learner_skills.user_id, COUNT(*) AS skills
    FROM learner_skills
    WHERE
      learner_skills.state = 'mastered'
      AND learner_skills.user_id IN (SELECT learners.user_id FROM learners)
    GROUP BY learner_skills.user_id
  ),
  paid AS (
    SELECT DISTINCT subscriptions.reference_id AS user_id
    FROM subscriptions
    WHERE subscriptions.plan != 'free' AND subscriptions.status = 'active'
  )
`;

/**
 * One row per stratum and mode with the sums every compared metric is a ratio of. It reads the
 * CTEs above plus `retention`.
 */
export const modeStratumSumsSql = sql`
  SELECT
    learners.mode,
    learners.goal_kind AS "goalKind",
    learners.age_band AS "ageBand",
    learners.locale,
    learners.signup_week AS "signupWeek",
    COUNT(*)::float AS learners,
    COUNT(*) FILTER (WHERE retention.d1_eligible)::float AS "d1Eligible",
    COUNT(*) FILTER (WHERE retention.d1_eligible AND retention.d1_retained)::float AS "d1Retained",
    COUNT(*) FILTER (WHERE retention.d7_eligible)::float AS "d7Eligible",
    COUNT(*) FILTER (WHERE retention.d7_eligible AND retention.d7_retained)::float AS "d7Retained",
    COUNT(*) FILTER (WHERE retention.d30_eligible)::float AS "d30Eligible",
    COUNT(*) FILTER (WHERE retention.d30_eligible AND retention.d30_retained)::float AS "d30Retained",
    SUM(COALESCE(active_days.days, 0))::float AS "activeDays",
    SUM(GREATEST(1, (${utcTodaySql} - learners.signup_date + 1) / 7.0))::float AS weeks,
    SUM(COALESCE(sessions.started, 0))::float AS "sessionsStarted",
    SUM(COALESCE(sessions.completed, 0))::float AS "sessionsCompleted",
    SUM(COALESCE(study_time.seconds, 0))::float AS "studySeconds",
    SUM(COALESCE(study_time.days, 0))::float AS "studyDays",
    SUM(COALESCE(spaced_answers.answers, 0))::float AS "spacedAnswers",
    SUM(COALESCE(spaced_answers.correct, 0))::float AS "spacedCorrect",
    SUM(COALESCE(mastered.skills, 0))::float AS "masteredSkills",
    COUNT(paid.user_id)::float AS paid
  FROM learners
  JOIN retention ON retention.user_id = learners.user_id
  LEFT JOIN active_days ON active_days.user_id = learners.user_id
  LEFT JOIN sessions ON sessions.user_id = learners.user_id
  LEFT JOIN study_time ON study_time.user_id = learners.user_id
  LEFT JOIN spaced_answers ON spaced_answers.user_id = learners.user_id
  LEFT JOIN mastered ON mastered.user_id = learners.user_id
  LEFT JOIN paid ON paid.user_id = learners.user_id
  GROUP BY
    learners.mode,
    learners.goal_kind,
    learners.age_band,
    learners.locale,
    learners.signup_week
`;
