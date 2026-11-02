const DAY_PLACEMENT_ANSWERS = 12;

const DAY_PLACEMENT_MS = 240_000;

/** Idle time must not end a day's placement after one answer. */
const MAX_COUNTED_ANSWER_MS = 60_000;

export const SESSION_PLACEMENT_QUESTIONS = 3;

export const PLACEMENT_WEEK_DAYS = 7;

const TOPIC_ANSWER_MS = 40_000;

/** Returns a fraction from 0 to 1, never a promise of remaining questions; topics expands the budget for full-material tests. */
export function getPlacementBudgetSpent({
  answers,
  topics = 0,
}: {
  answers: readonly { durationMs: number }[];
  topics?: number;
}): number {
  const spent = answers.reduce(
    (total, answer) => total + Math.min(answer.durationMs, MAX_COUNTED_ANSWER_MS),
    0,
  );

  return Math.min(
    1,
    Math.max(
      answers.length / Math.max(DAY_PLACEMENT_ANSWERS, topics),
      spent / Math.max(DAY_PLACEMENT_MS, topics * TOPIC_ANSWER_MS),
    ),
  );
}
