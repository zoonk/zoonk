/** Exam-format reading and working takes longer than quick reviews. */
export const PRACTICE_MINUTES_PER_QUESTION = 1.5;

/** Shorter than this, a block isn't worth a stop of its own. */
export const MIN_BLOCK_MINUTES = 3;

export function toMinutes(value: number): number {
  return Math.max(1, Math.round(value));
}
