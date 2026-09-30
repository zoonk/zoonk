/** The FSRS review grades, named for how the answer went. */
export type ReviewRating = "again" | "hard" | "good" | "easy";

/** What an answer says about memory. Grading (right, wrong, partial credit) happens before this. */
export type GradedAnswer = {
  isCorrect: boolean;
  /** Partial credit from 0 to 1 for typed or spoken answers graded one key point at a time. */
  score?: number | null;
  durationMs: number;
  /** How long this question should take; defaults to a quick question. */
  expectedDurationMs?: number;
  /** A hint, "Explain first" or any help shown before answering. */
  usedHint?: boolean;
};

const DEFAULT_EXPECTED_DURATION_MS = 20_000;

/**
 * A skill placement or a passed test-out shows the learner can do, without asking about it: it
 * counts as one plain right answer (Good), so a review soon confirms it is remembered.
 */
export const INFERRED_KNOWN_ANSWER: GradedAnswer = {
  durationMs: DEFAULT_EXPECTED_DURATION_MS,
  isCorrect: true,
};
const FAST_SHARE = 0.5;
const SLOW_FACTOR = 2;
const PASSING_SCORE = 0.5;

/**
 * Turns one graded answer into an FSRS grade. A wrong answer (or less than half the key points) is
 * Again; help, partial credit or taking over twice the expected time is Hard; answering in under
 * half the expected time is Easy; everything else is Good. It's a code rule rather than a model's
 * score: partial credit already comes from the per-key-point grader, and help and time are facts
 * code measures, so asking a model again would add cost and noise without new information.
 */
export function rateAnswer({
  durationMs,
  expectedDurationMs = DEFAULT_EXPECTED_DURATION_MS,
  isCorrect,
  score,
  usedHint = false,
}: GradedAnswer): ReviewRating {
  const hasScore = typeof score === "number";

  if (!isCorrect || (hasScore && score < PASSING_SCORE)) {
    return "again";
  }

  if (usedHint || (hasScore && score < 1) || durationMs > expectedDurationMs * SLOW_FACTOR) {
    return "hard";
  }

  if (durationMs < expectedDurationMs * FAST_SHARE) {
    return "easy";
  }

  return "good";
}

/**
 * Remembered means right with nothing to lean on: correct, full credit and no help. Only a recall
 * counts toward the three days a skill needs to be Mastered.
 */
export function isUnaidedRecall({ isCorrect, score, usedHint = false }: GradedAnswer): boolean {
  return isCorrect && !usedHint && (typeof score !== "number" || score >= 1);
}
