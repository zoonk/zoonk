import { describe, expect, it } from "vitest";
import { getDroppedCall } from "./dropped-call";

const RECONNECT = { continuing: true, microphoneProblem: null, phase: "failed" } as const;

describe(getDroppedCall, () => {
  it.each([
    // Also a reconnect the learner cancelled while it rang.
    ["dropped", { reason: null, retry: "callAgain" }],
    ["connect", { reason: null, retry: "callAgain" }],
    ["callsPaused", { reason: "callsPaused", retry: "callAgain" }],
    ["callInProgress", { reason: "callInProgress", retry: "takeover" }],
    ["limit", { reason: "limit", retry: null }],
    ["plusRequired", { reason: "plusRequired", retry: null }],
    ["ended", { reason: "ended", retry: null }],
  ] as const)("explains a reconnect of a dropped call that ended in %s", (error, shown) => {
    expect(getDroppedCall({ ...RECONNECT, error })).toStrictEqual(shown);
  });

  it.each(["blocked", "unavailable"] as const)(
    "explains a microphone that's %s and offers it again or typing",
    (microphoneProblem) => {
      expect(
        getDroppedCall({ ...RECONNECT, error: null, microphoneProblem, phase: "idle" }),
      ).toStrictEqual({ reason: "microphone", retry: "microphone" });
    },
  );

  it("shows a first call that dropped with the plain line", () => {
    expect(getDroppedCall({ ...RECONNECT, continuing: false, error: "dropped" })).toStrictEqual({
      reason: null,
      retry: "callAgain",
    });
  });

  it("leaves a first call's own problems, and a reconnect still on its way, to their screens", () => {
    expect(getDroppedCall({ ...RECONNECT, continuing: false, error: "connect" })).toBeNull();

    expect(
      getDroppedCall({
        ...RECONNECT,
        continuing: false,
        error: null,
        microphoneProblem: "blocked",
        phase: "idle",
      }),
    ).toBeNull();

    expect(getDroppedCall({ ...RECONNECT, error: null, phase: "connecting" })).toBeNull();

    expect(
      getDroppedCall({
        ...RECONNECT,
        error: null,
        microphoneProblem: "blocked",
        phase: "connecting",
      }),
    ).toBeNull();
  });
});
