import { LIVE_CALL_GRACE_SECONDS } from "@zoonk/core/entitlements/limits";
import { describe, expect, it } from "vitest";
import { getCallEndsAt } from "./call-deadline";

const RESERVED_AT = Date.parse("2026-10-13T12:00:00.000Z");
const GRACE_MS = LIVE_CALL_GRACE_SECONDS * 1000;

/** A reservation the server made at `RESERVED_AT` for `seconds`, with its absolute deadline. */
function reservation(seconds: number) {
  return { deadlineAt: new Date(RESERVED_AT + seconds * 1000 + GRACE_MS).toISOString(), seconds };
}

describe(getCallEndsAt, () => {
  it("ends the call's length after the reserved seconds when the answer arrives at once", () => {
    expect(getCallEndsAt({ ...reservation(60), now: RESERVED_AT })).toBe(RESERVED_AT + 60_000);
  });

  it("takes a slow answer out of the call instead of starting its clock later", () => {
    expect(getCallEndsAt({ ...reservation(60), now: RESERVED_AT + 4000 })).toBe(
      RESERVED_AT + 60_000,
    );
  });

  it("never runs past the deadline less the server's goodbye and closing time", () => {
    const { deadlineAt } = reservation(30);

    expect(getCallEndsAt({ deadlineAt, now: RESERVED_AT, seconds: 300 })).toBe(
      Date.parse(deadlineAt) - GRACE_MS,
    );
  });

  it("uses the reserved seconds when they end before the deadline allows", () => {
    const { deadlineAt } = reservation(120);

    expect(getCallEndsAt({ deadlineAt, now: RESERVED_AT, seconds: 45 })).toBe(RESERVED_AT + 45_000);
  });
});
