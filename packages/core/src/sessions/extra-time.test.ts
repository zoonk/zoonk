import { describe, expect, it } from "vitest";
import { getExtraTime } from "./extra-time";

const done = { extra: false, status: "completed" as const };

describe(getExtraTime, () => {
  it("offers ten more minutes once the day's blocks are done or stopped", () => {
    expect(
      getExtraTime({
        blocks: [done, { extra: false, status: "skipped" }],
        remainingLimitMinutes: null,
      }),
    ).toStrictEqual({ available: true, minutes: 10, reason: null });
  });

  it("waits until the session is finished", () => {
    expect(
      getExtraTime({
        blocks: [done, { extra: false, status: "active" }],
        remainingLimitMinutes: null,
      }),
    ).toStrictEqual({ available: false, minutes: 10, reason: "sessionNotFinished" });
  });

  it("lets practice the learner asks for start before the session is done, still capped", () => {
    const pending = { extra: false, status: "pending" as const };

    expect(
      getExtraTime({ anytime: true, blocks: [done, pending], remainingLimitMinutes: null }),
    ).toStrictEqual({ available: true, minutes: 10, reason: null });

    expect(
      getExtraTime({
        anytime: true,
        blocks: [pending, { extra: true, status: "completed" }, { extra: true, status: "active" }],
        remainingLimitMinutes: null,
      }),
    ).toStrictEqual({ available: false, minutes: 10, reason: "dailyCap" });
  });

  it("never becomes an endless feed", () => {
    expect(
      getExtraTime({
        blocks: [done, { extra: true, status: "completed" }, { extra: true, status: "completed" }],
        remainingLimitMinutes: null,
      }),
    ).toStrictEqual({ available: false, minutes: 10, reason: "dailyCap" });
  });

  it("fits a guardian's limit and hides once it's reached", () => {
    expect(getExtraTime({ blocks: [done], remainingLimitMinutes: 6 })).toStrictEqual({
      available: true,
      minutes: 6,
      reason: null,
    });

    expect(getExtraTime({ blocks: [done], remainingLimitMinutes: 0 })).toStrictEqual({
      available: false,
      minutes: 0,
      reason: "dailyLimit",
    });
  });
});
