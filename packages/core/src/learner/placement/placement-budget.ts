/**
 * Placement's budget for one day, the first included: a few minutes. Past this many answers, or
 * this much answering time, it stops for the day with what it knows, and the first week's
 * sessions ask the rest a few at a time, so the learner starts learning on day 1.
 */
const DAY_PLACEMENT_ANSWERS = 12;

const DAY_PLACEMENT_MS = 240_000;

/**
 * One answer counts for at most this long: a question left open while the learner stepped away
 * isn't minutes of answering, and would otherwise end the day's placement after one answer.
 */
const MAX_COUNTED_ANSWER_MS = 60_000;

/** Placement questions each of the goal's first-week sessions carries, while any phase is unsure. */
export const SESSION_PLACEMENT_QUESTIONS = 3;

/** Placement spreads over the goal's first week; after that, lessons and reviews refine it. */
export const PLACEMENT_WEEK_DAYS = 7;

/** A topic of the learner's own material takes about this long: a quick answer, or a typed one. */
const TOPIC_ANSWER_MS = 40_000;

/**
 * Whether today's placement answers used up the day's few minutes. A test from the learner's own
 * material asks every one of its `topics` (see `answeredOnly`), so its day has room for an answer
 * on each: a class test days away has no first week to ask the rest in.
 */
export function isPlacementBudgetUsed({
  answers,
  topics = 0,
}: {
  answers: readonly { durationMs: number }[];
  topics?: number;
}): boolean {
  const spent = answers.reduce(
    (total, answer) => total + Math.min(answer.durationMs, MAX_COUNTED_ANSWER_MS),
    0,
  );

  return (
    answers.length >= Math.max(DAY_PLACEMENT_ANSWERS, topics) ||
    spent >= Math.max(DAY_PLACEMENT_MS, topics * TOPIC_ANSWER_MS)
  );
}
