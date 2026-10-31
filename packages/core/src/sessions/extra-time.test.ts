import { describe, expect, it } from "vitest";
import { getExtraTime } from "./extra-time";

const done = { status: "completed" as const };

describe(getExtraTime, () => {
  it("offers more time once the day's blocks are done or stopped", () => {
    expect(
      getExtraTime({ blocks: [done, { ...done, status: "skipped" }], remainingLimitMinutes: null }),
    ).toStrictEqual({ available: true, lessons: [], minutes: 10, reason: null });
  });

  it("waits until the session is finished", () => {
    expect(
      getExtraTime({ blocks: [done, { ...done, status: "active" }], remainingLimitMinutes: null }),
    ).toStrictEqual({ available: false, lessons: [], minutes: 10, reason: "sessionNotFinished" });
  });

  it("lets practice the learner asks for start before the session is done", () => {
    expect(
      getExtraTime({
        anytime: true,
        blocks: [done, { ...done, status: "pending" }],
        remainingLimitMinutes: null,
      }),
    ).toStrictEqual({ available: true, lessons: [], minutes: 10, reason: null });
  });

  it("keeps going however many blocks were added already", () => {
    expect(
      getExtraTime({ blocks: [done, done, done, done, done], remainingLimitMinutes: null }),
    ).toStrictEqual({ available: true, lessons: [], minutes: 10, reason: null });
  });

  it("fits the learner's daily limit and hides once it's reached", () => {
    expect(getExtraTime({ blocks: [done], remainingLimitMinutes: 6 })).toStrictEqual({
      available: true,
      lessons: [],
      minutes: 6,
      reason: null,
    });

    expect(getExtraTime({ blocks: [done], remainingLimitMinutes: 0 })).toStrictEqual({
      available: false,
      lessons: [],
      minutes: 0,
      reason: "dailyLimit",
    });
  });
});
