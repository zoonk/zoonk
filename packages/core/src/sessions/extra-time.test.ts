import { describe, expect, it } from "vitest";
import { getExtraTime } from "./extra-time";

const done = { status: "completed" as const };

describe(getExtraTime, () => {
  it("offers more time once the day's blocks are done or stopped", () => {
    expect(
      getExtraTime({ blocks: [done, { ...done, status: "skipped" }], current: true }),
    ).toStrictEqual({ available: true, lessons: [], minutes: 10, reason: null });
  });

  it("waits until the session is finished", () => {
    expect(
      getExtraTime({ blocks: [done, { ...done, status: "active" }], current: true }),
    ).toStrictEqual({ available: false, lessons: [], minutes: 10, reason: "sessionNotFinished" });
  });

  it("lets practice the learner asks for start before the session is done", () => {
    expect(
      getExtraTime({
        anytime: true,
        blocks: [done, { ...done, status: "pending" }],
        current: true,
      }),
    ).toStrictEqual({ available: true, lessons: [], minutes: 10, reason: null });
  });

  it("keeps going however many blocks were added already", () => {
    expect(getExtraTime({ blocks: [done, done, done, done, done], current: true })).toStrictEqual({
      available: true,
      lessons: [],
      minutes: 10,
      reason: null,
    });
  });
});
