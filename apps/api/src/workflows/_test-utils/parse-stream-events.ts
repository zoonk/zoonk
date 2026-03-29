import { isJsonObject } from "@zoonk/utils/json";

/**
 * Safely parses a JSON string into a Record<string, unknown>.
 * Used in test utilities to parse SSE event data from mock write calls.
 */
function parseEvent(raw: unknown): Record<string, unknown> {
  const parsed: unknown = JSON.parse(String(raw).replace("data: ", "").trim());
  return isJsonObject(parsed) ? parsed : {};
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
