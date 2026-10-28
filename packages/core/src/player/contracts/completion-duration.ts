const SECONDS_PER_MINUTE = 60;
const MAX_LESSON_MINUTES = 30;
const MS_PER_SECOND = 1000;

/** Idle tabs must not add hours of active study time. */
export function getCappedLessonDurationSeconds({
  now,
  startedAt,
}: {
  now: number;
  startedAt: number;
}) {
  const seconds = Math.floor((now - startedAt) / MS_PER_SECOND);
  return Math.max(0, Math.min(seconds, MAX_LESSON_MINUTES * SECONDS_PER_MINUTE));
}
