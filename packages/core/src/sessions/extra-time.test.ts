import { describe, expect, it } from "vitest";
import { getExtraTime, listsUpNext } from "./extra-time";

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

  it("doesn't wait for a mock still being prepared", () => {
    expect(
      getExtraTime({ blocks: [done, { preparing: true, status: "pending" }], current: true }),
    ).toStrictEqual({ available: true, lessons: [], minutes: 10, reason: null });
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

describe(listsUpNext, () => {
  const day = { emptyDay: null, lessonsComing: false, lessonsToPrepare: false };

  it("lists the plan's next lessons once the day has nothing of its own to come", () => {
    expect(listsUpNext(day)).toBe(true);
  });

  it("keeps the day's own lessons first, and practice as a day with nothing new's offer", () => {
    expect(listsUpNext({ ...day, lessonsComing: true })).toBe(false);
    expect(listsUpNext({ ...day, lessonsToPrepare: true })).toBe(false);
    expect(listsUpNext({ ...day, emptyDay: "lessonsComing" })).toBe(false);
    expect(listsUpNext({ ...day, emptyDay: "lessonsToPrepare" })).toBe(false);
    expect(listsUpNext({ ...day, emptyDay: "nothingNew" })).toBe(false);
  });
});
