import { isJsonObject } from "@zoonk/utils/json";
import { getWorkflowWriteMock } from "./workflow-mock";

/**
 * Safely parses a JSON string into a Record<string, unknown>.
 * Used in test utilities to parse SSE event data from mock write calls.
 */
function parseEvent(raw: unknown): Record<string, unknown> {
  const parsed: unknown = JSON.parse(String(raw).replace("data: ", "").trim());
  return isJsonObject(parsed) ? parsed : {};
}

/**
 * Every event carries the time its step reported it (`at`), which assertions don't pin: a step's
 * event without one fails here instead.
 */
function withoutTime(event: Record<string, unknown>): Record<string, unknown> {
  const { at, ...rest } = event;

  if (typeof at !== "number") {
    throw new TypeError(`Streamed event without its time: ${JSON.stringify(event)}`);
  }

  return rest;
}

/**
 * Extracts parsed SSE events from the writeMock's call history.
 * Each write call contains a string like `data: {"at":…,"status":"started","step":"..."}\n\n`.
 * This parses them into objects for easy assertion, without the time each was sent.
 */
export function getStreamedEvents(
  writeMock: { mock: { calls: unknown[][] } } = getWorkflowWriteMock(),
): Record<string, unknown>[] {
  return writeMock.mock.calls.map(([raw]) => withoutTime(parseEvent(raw)));
}
