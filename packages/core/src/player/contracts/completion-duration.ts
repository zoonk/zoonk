const SECONDS_PER_MINUTE = 60;
const MAX_COMPLETION_MINUTES = 30;

const MAX_LESSON_COMPLETION_SECONDS = MAX_COMPLETION_MINUTES * SECONDS_PER_MINUTE;
const MAX_STEP_ATTEMPT_SECONDS = MAX_COMPLETION_MINUTES * SECONDS_PER_MINUTE;

/**
 * Completion durations come from browser timestamps, so a learner can leave a
 * tab open for hours before finishing a lesson. Capping the elapsed time keeps
 * learning-time metrics focused on an active lesson session instead of idle tab
 * time, while still preserving every real duration currently seen in production.
 */
export function getCappedLessonDurationSeconds({
  now = Date.now(),
  startedAt,
}: {
  now?: number;
  startedAt: number;
}) {
  return clampDurationSeconds({
    durationSeconds: Math.floor((now - startedAt) / 1000),
    maxSeconds: MAX_LESSON_COMPLETION_SECONDS,
  });
}

/**
 * Step timing is also submitted by the client. Keeping the same guard around
 * each persisted attempt prevents forged payloads or long-idle steps from
 * creating outlier rows that later distort timing analysis.
 */
export function getCappedStepAttemptDurationSeconds({
  durationSeconds,
}: {
  durationSeconds: number;
}) {
  return clampDurationSeconds({ durationSeconds, maxSeconds: MAX_STEP_ATTEMPT_SECONDS });
}

/**
 * The cap helper accepts any number because persisted metrics should fail
 * closed: negative, fractional, and non-finite client values become safe
 * whole-second counts before they reach analytics tables.
 */
function clampDurationSeconds({
  durationSeconds,
  maxSeconds,
}: {
  durationSeconds: number;
  maxSeconds: number;
}) {
  if (!Number.isFinite(durationSeconds)) {
    return 0;
  }

  return Math.max(0, Math.min(Math.floor(durationSeconds), maxSeconds));
}
