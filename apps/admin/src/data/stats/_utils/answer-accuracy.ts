import { trackedAnalyticsUserSql } from "@/data/stats/_utils/analytics-user-filter";
import { type Sql, sql } from "@zoonk/db";

export type AnswerSumsRow = { correct: bigint | null; incorrect: bigint | null };

/**
 * Accuracy is the share of correct answers. With no answers it's zero rather than undefined, so
 * cards and headlines always have a number to show.
 */
export function getAnswerAccuracy({ correct, incorrect }: AnswerSumsRow): number {
  const correctAnswers = Number(correct ?? 0);
  const total = correctAnswers + Number(incorrect ?? 0);

  return total === 0 ? 0 : (correctAnswers / total) * 100;
}

function getRangeSql({ column, end, start }: { column: Sql; end?: Date; start?: Date }): Sql {
  if (!start || !end) {
    return sql``;
  }

  return sql`AND ${column} >= ${start} AND ${column} <= ${end}`;
}

/**
 * Every answer once, as `answered_at`, `correct` and `incorrect` rows of tracked learners. v2
 * answers are `attempts` rows (lessons, sessions, mocks, practice and placement). Legacy answers
 * only survive as totals on the legacy lessons' ledger rows, which the learning v2 migration tagged
 * with `legacyLessonId`. Other ledger rows repeat answers that
 * are already attempts (a session row sums its blocks), so they're left out.
 */
export function getAnswersSql({ end, start }: { end?: Date; start?: Date } = {}): Sql {
  return sql`
    SELECT
      attempts.answered_at,
      CASE WHEN attempts.is_correct THEN 1 ELSE 0 END AS correct,
      CASE WHEN attempts.is_correct THEN 0 ELSE 1 END AS incorrect
    FROM attempts
    JOIN users ON users.id = attempts.user_id
    WHERE
      ${trackedAnalyticsUserSql}
      ${getRangeSql({ column: sql`attempts.answered_at`, end, start })}

    UNION ALL

    SELECT
      learning_events.ended_at AS answered_at,
      learning_events.correct_answers AS correct,
      learning_events.incorrect_answers AS incorrect
    FROM learning_events
    JOIN users ON users.id = learning_events.user_id
    WHERE
      ${trackedAnalyticsUserSql}
      AND learning_events.ended_at IS NOT NULL
      AND learning_events.content_ids->>'legacyLessonId' IS NOT NULL
      ${getRangeSql({ column: sql`learning_events.ended_at`, end, start })}
  `;
}
