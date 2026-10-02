/**
 * A sharp drop in accuracy usually means tiredness, not a lack of knowledge. When the last answers
 * are mostly wrong after a session that was going well, the session suggests a pause. It never
 * forces one: stopping for today always counts.
 */
const RECENT_ANSWERS = 5;
const MAX_RECENT_RIGHT = 1;
const MIN_EARLIER_ANSWERS = 5;
const MIN_EARLIER_ACCURACY = 0.6;

/** Whether to suggest a pause, from the session's answers in the order they were given. */
export function shouldSuggestPause(answers: readonly boolean[]): boolean {
  if (answers.length < RECENT_ANSWERS + MIN_EARLIER_ANSWERS) {
    return false;
  }

  const earlier = answers.slice(0, -RECENT_ANSWERS);
  const recentRight = answers.slice(-RECENT_ANSWERS).filter(Boolean).length;
  const earlierAccuracy = earlier.filter(Boolean).length / earlier.length;

  return recentRight <= MAX_RECENT_RIGHT && earlierAccuracy >= MIN_EARLIER_ACCURACY;
}
