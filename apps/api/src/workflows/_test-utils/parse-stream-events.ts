/**
 * Type guard that checks if a value is a non-null object (Record-like).
 * Used to safely narrow `unknown` from JSON.parse into Record<string, unknown>.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Safely parses a JSON string into a Record<string, unknown>.
 * Used in test utilities to parse SSE event data from mock write calls.
 */
function parseEvent(raw: unknown): Record<string, unknown> {
  const parsed: unknown = JSON.parse(String(raw).replace("data: ", "").trim());
  return isRecord(parsed) ? parsed : {};
}

/**
 * Extracts parsed SSE events from the writeMock's call history.
 * Each write call contains a string like `data: {"status":"started","step":"..."}\n\n`.
 * This parses them into objects for easy assertion.
 */
export function getStreamedEvents(writeMock: {
  mock: { calls: unknown[][] };
}): Record<string, unknown>[] {
  return writeMock.mock.calls.map(([raw]) => parseEvent(raw));
}
