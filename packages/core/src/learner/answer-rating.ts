export type ReviewRating = "again" | "hard" | "good" | "easy";

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

/** Inferred knowledge is Good, leaving an early review to confirm recall. */
export const INFERRED_KNOWN_ANSWER: GradedAnswer = {
  durationMs: DEFAULT_EXPECTED_DURATION_MS,
  isCorrect: true,
};
const FAST_SHARE = 0.5;
const SLOW_FACTOR = 2;
const PASSING_SCORE = 0.5;

/** Uses only first answers and ignores timing; returns null for lessons with no answers. */
export function gradeLessonAnswers(firstAnswers: readonly boolean[]): GradedAnswer | null {
  if (firstAnswers.length === 0) {
    return null;
  }

  const score = firstAnswers.filter(Boolean).length / firstAnswers.length;

  return { durationMs: DEFAULT_EXPECTED_DURATION_MS, isCorrect: score >= PASSING_SCORE, score };
}

export function rateAnswer({
  durationMs,
  expectedDurationMs = DEFAULT_EXPECTED_DURATION_MS,
  isCorrect,
  score,
  usedHint = false,
}: GradedAnswer): ReviewRating {
  if (!isCorrect) {
    return "again";
  }

  const partialCredit = typeof score === "number" && score < 1;

  if (usedHint || partialCredit || durationMs > expectedDurationMs * SLOW_FACTOR) {
    return "hard";
  }

  if (durationMs < expectedDurationMs * FAST_SHARE) {
    return "easy";
  }

  return "good";
}

export function isUnaidedRecall({ isCorrect, score, usedHint = false }: GradedAnswer): boolean {
  return isCorrect && !usedHint && (typeof score !== "number" || score >= 1);
}
