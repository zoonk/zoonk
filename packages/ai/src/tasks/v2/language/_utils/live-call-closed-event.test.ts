import { describe, expect, it } from "vitest";
import { readLiveCallClosedEvent } from "./live-call-closed-event";

const SESSION_ID = "live_test";

function receipt(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    reason: "close_requested",
    session: { id: SESSION_ID },
    type: "session.closed",
    usage: { seconds: 45.8 },
    ...overrides,
  });
}

function read(data: unknown) {
  return readLiveCallClosedEvent({ data, providerSessionId: SESSION_ID });
}

describe(readLiveCallClosedEvent, () => {
  it("preserves provider-confirmed fractional seconds for settlement", () => {
    expect(read(receipt())).toStrictEqual({
      reason: "close_requested",
      seconds: 45.8,
      status: "closed",
    });
  });

  it("confirms a provider-reported connection loss only with the terminal receipt", () => {
    expect(read(receipt({ reason: "connection_lost" }))).toStrictEqual({
      reason: "connection_lost",
      seconds: 45.8,
      status: "closed",
    });
  });

  it("leaves initialization billing to settlement even when final usage is shorter", () => {
    expect(read(receipt({ usage: { seconds: 2 } }))).toMatchObject({ seconds: 2 });
  });

  it("cannot settle from a running usage update", () => {
    expect(read(receipt({ type: "session.usage.updated" }))).toBeNull();
  });

  it("does not interpret already-ended errors or a 404 as terminal confirmation", () => {
    expect(
      read(
        receipt({
          error: { code: "session_not_found", message: "Session already ended", status: 404 },
          type: "error",
        }),
      ),
    ).toBeNull();
  });

  it("rejects another session's otherwise valid receipt", () => {
    expect(() => read(receipt({ session: { id: "live_other" } }))).toThrow(
      "Live call terminal receipt belongs to a different session.",
    );
  });

  it.each([
    { session: null },
    { usage: null },
    { usage: { seconds: -1 } },
    { usage: { seconds: null } },
    { usage: { seconds: "45.8" } },
  ])("rejects a terminal event without trustworthy session usage: %j", (overrides) => {
    expect(() => read(receipt(overrides))).toThrow();
  });

  it("rejects unreadable sideband data", () => {
    expect(() => read("invalid-json")).toThrow();

    expect(() => read(new Uint8Array([1, 2]))).toThrow(
      "Live call sideband returned a non-text event.",
    );
  });
});
