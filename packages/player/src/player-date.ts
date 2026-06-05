/**
 * Completion payloads and same-day milestone suppression both need the learner's
 * local calendar date, not UTC, because DailyProgress is keyed by localDate.
 */
export function getLocalDate(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
