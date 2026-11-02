import { describe, expect, it } from "vitest";
import { BLOCKED_TEST_CALL, isBlockedTestCall } from "./blocked-test-call";

describe(isBlockedTestCall, () => {
  it("finds the kill switch's error, also when another error wraps it", () => {
    const blocked = new Error(BLOCKED_TEST_CALL);

    expect(isBlockedTestCall(blocked)).toBe(true);
    expect(isBlockedTestCall(new Error("Step failed", { cause: blocked }))).toBe(true);
  });

  it("leaves every other failure, and a cause chain that loops, alone", () => {
    const looping = new Error("Provider refused");
    looping.cause = looping;

    expect(isBlockedTestCall(new Error("Provider refused"))).toBe(false);
    expect(isBlockedTestCall(looping)).toBe(false);
    expect(isBlockedTestCall(BLOCKED_TEST_CALL)).toBe(false);
  });
});
