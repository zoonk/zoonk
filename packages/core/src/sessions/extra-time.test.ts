import { describe, expect, it } from "vitest";
import { getExtraTime, hasExtraPracticeLeft } from "./extra-time";

const done = { extra: false, kind: "learn" as const, status: "completed" as const };
const extraLesson = { extra: true, kind: "learn" as const, status: "completed" as const };
const extraPractice = { extra: true, kind: "practice" as const, status: "completed" as const };

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

  it("keeps going with the plan's lessons however many were added already", () => {
    expect(
      getExtraTime({
        blocks: [done, extraLesson, extraLesson, extraLesson],
        remainingLimitMinutes: null,
      }),
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

describe(hasExtraPracticeLeft, () => {
  it("never becomes an endless feed of bonus practice", () => {
    expect(hasExtraPracticeLeft([done, extraPractice])).toBe(true);
    expect(hasExtraPracticeLeft([done, extraPractice, extraPractice])).toBe(false);
  });

  it("doesn't count the plan's lessons studied a day early as bonus practice", () => {
    expect(hasExtraPracticeLeft([done, extraLesson, extraLesson, extraPractice])).toBe(true);
  });
});
