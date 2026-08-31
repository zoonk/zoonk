const INITIAL_POLL_DELAY_MILLISECONDS = 1000;
const MAX_POLL_DELAY_MILLISECONDS = 5000;
const MAX_POLL_ATTEMPTS = 8;
const MAX_POLL_DURATION_MILLISECONDS = 60_000;
const MINIMUM_JITTER_MULTIPLIER = 0.8;
const JITTER_RANGE = 0.4;

export function hasLessonQuestionPollingBudget({
  attempt,
  elapsedMilliseconds,
}: {
  attempt: number;
  elapsedMilliseconds: number;
}) {
  return attempt < MAX_POLL_ATTEMPTS && elapsedMilliseconds < MAX_POLL_DURATION_MILLISECONDS;
}

export function getLessonQuestionPollDelay({
  attempt,
  elapsedMilliseconds,
  random = Math.random(),
}: {
  attempt: number;
  elapsedMilliseconds: number;
  random?: number;
}): number | null {
  if (!hasLessonQuestionPollingBudget({ attempt, elapsedMilliseconds })) {
    return null;
  }

  const exponentialDelay = Math.min(
    INITIAL_POLL_DELAY_MILLISECONDS * 2 ** attempt,
    MAX_POLL_DELAY_MILLISECONDS,
  );

  const jitterMultiplier = MINIMUM_JITTER_MULTIPLIER + random * JITTER_RANGE;
  return Math.round(exponentialDelay * jitterMultiplier);
}
