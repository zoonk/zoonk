const DAY_PLACEMENT_ANSWERS = 12;

const DAY_PLACEMENT_MS = 240_000;

/** Idle time must not end a day's placement after one answer. */
const MAX_COUNTED_ANSWER_MS = 60_000;

export const SESSION_PLACEMENT_QUESTIONS = 3;

export const PLACEMENT_WEEK_DAYS = 7;

/** Returns a fraction from 0 to 1, never a promise of remaining questions. */
export function getPlacementBudgetSpent(answers: readonly { durationMs: number }[]): number {
  const spent = answers.reduce(
    (total, answer) => total + Math.min(answer.durationMs, MAX_COUNTED_ANSWER_MS),
    0,
  );

  return Math.min(1, Math.max(answers.length / DAY_PLACEMENT_ANSWERS, spent / DAY_PLACEMENT_MS));
}
