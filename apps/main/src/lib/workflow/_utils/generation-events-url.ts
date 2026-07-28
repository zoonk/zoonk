/**
 * Builds the canonical generation-events resource URL. Reconnect count remains
 * a harmless query value that gives React a new URL, while `useSSE` appends the
 * durable stream index used to resume without replaying handled events.
 */
export function getGenerationEventsUrl({
  baseUrl,
  generationId,
  reconnectCount,
}: {
  baseUrl: string;
  generationId: string;
  reconnectCount: number;
}) {
  return `${baseUrl}/${encodeURIComponent(generationId)}/events?_rc=${reconnectCount}`;
}
