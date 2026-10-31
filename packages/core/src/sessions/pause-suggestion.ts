/** Suggest a pause after accuracy falls sharply; never force the learner to stop. */
const RECENT_ANSWERS = 5;
const MAX_RECENT_RIGHT = 1;
const MIN_EARLIER_ANSWERS = 5;
const MIN_EARLIER_ACCURACY = 0.6;

/** Requires answers in submission order. */
export function shouldSuggestPause(answers: readonly boolean[]): boolean {
  if (answers.length < RECENT_ANSWERS + MIN_EARLIER_ANSWERS) {
    return false;
  }

  const earlier = answers.slice(0, -RECENT_ANSWERS);
  const recentRight = answers.slice(-RECENT_ANSWERS).filter(Boolean).length;
  const earlierAccuracy = earlier.filter(Boolean).length / earlier.length;

  return recentRight <= MAX_RECENT_RIGHT && earlierAccuracy >= MIN_EARLIER_ACCURACY;
}
