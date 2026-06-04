/**
 * Progress insight fixtures seed their winning rows on the current UTC day.
 * Formatting that day here the same way as the page keeps value assertions
 * stable when the test suite runs on a different calendar date.
 */
export function getCurrentUtcProgressInsightDateLabel(): string {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(today);
}
