import { isJsonObject } from "@zoonk/utils/json";
import { getWorkflowWriteMock } from "./workflow-mock";

function parseEvent(raw: unknown): Record<string, unknown> {
  const parsed: unknown = JSON.parse(String(raw).replace("data: ", "").trim());
  return isJsonObject(parsed) ? parsed : {};
}

function withoutTime(event: Record<string, unknown>): Record<string, unknown> {
  const { at, ...rest } = event;

  if (typeof at !== "number") {
    throw new TypeError(`Streamed event without its time: ${JSON.stringify(event)}`);
  }

  return rest;
}

export function getStreamedEvents(
  writeMock: { mock: { calls: unknown[][] } } = getWorkflowWriteMock(),
): Record<string, unknown>[] {
  return writeMock.mock.calls.map(([raw]) => withoutTime(parseEvent(raw)));
}
