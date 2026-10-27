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

/** Attempts count each answer once; ledger rows also sum answers from their activities. */
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
      ${start && end ? sql`AND attempts.answered_at >= ${start} AND attempts.answered_at <= ${end}` : sql``}
  `;
}
