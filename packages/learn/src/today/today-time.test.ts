import { describe, expect, it } from "vitest";
import { getDaySegmentCount, getDayTime, getFoldMinutes, getHeldMinutes } from "./today-time";

function step(estimatedMinutes: number, status: "active" | "completed" | "pending" | "skipped") {
  return { estimatedMinutes, status };
}

const SIXTEEN_LESSONS = [4, 4, 5, 4, 4, 4, 4, 3, 4, 4, 3, 4, 4, 3, 3, 4].map((minutes) =>
  step(minutes, "pending"),
);

describe(getDayTime, () => {
  it("says the server's time left, not the minutes of the rows written so far", () => {
    expect(
      getDayTime({ day: { minutes: { left: 240 }, state: "underway" }, studied: 0 }),
    ).toStrictEqual({ kind: "left", minutes: 240 });
  });

  it("says the time left while the day waits for its lessons", () => {
    expect(
      getDayTime({ day: { minutes: { left: 24 }, state: "waiting" }, studied: 30 }),
    ).toStrictEqual({ kind: "left", minutes: 24 });
  });

  it("says what was studied once the day is done", () => {
    expect(getDayTime({ day: { minutes: { left: 0 }, state: "done" }, studied: 47 })).toStrictEqual(
      { kind: "studied", minutes: 47 },
    );

    expect(getDayTime({ day: { minutes: { left: 0 }, state: "done" }, studied: 0 })).toBeNull();
  });

  it("says nothing on a day with no time left, such as a rest day", () => {
    expect(getDayTime({ day: { minutes: { left: 0 }, state: "rest" }, studied: 0 })).toBeNull();
  });
});

describe(getHeldMinutes, () => {
  it("holds the time beyond the unfinished rows for lessons still being written", () => {
    expect(
      getHeldMinutes({
        blocks: [step(8, "completed"), ...SIXTEEN_LESSONS],
        lessonsComing: true,
        lessonsToPrepare: false,
        minutes: { left: 240 },
      }),
    ).toBe(179);
  });

  it("holds time for lessons the learner still has to ask for", () => {
    expect(
      getHeldMinutes({
        blocks: [step(10, "active")],
        lessonsComing: false,
        lessonsToPrepare: true,
        minutes: { left: 30 },
      }),
    ).toBe(20);
  });

  it("holds nothing for a rounding difference when no lessons are on their way", () => {
    expect(
      getHeldMinutes({
        blocks: [step(10, "pending"), step(12, "pending")],
        lessonsComing: false,
        lessonsToPrepare: false,
        minutes: { left: 22.6 },
      }),
    ).toBe(0);
  });

  it("holds nothing when the rows already take the time left", () => {
    expect(
      getHeldMinutes({
        blocks: [step(30, "pending")],
        lessonsComing: true,
        lessonsToPrepare: false,
        minutes: { left: 24 },
      }),
    ).toBe(0);
  });
});

describe(getDaySegmentCount, () => {
  it.each([
    { blocks: [], held: true, segments: 0 },
    { blocks: [step(10, "pending")], held: true, segments: 2 },
    { blocks: [step(10, "pending")], held: false, segments: 1 },
    { blocks: [step(10, "pending"), step(10, "pending")], held: false, segments: 2 },
  ])(
    "counts $segments progress segments for $blocks with held time: $held",
    ({ blocks, held, segments }) => {
      expect(
        getDaySegmentCount({
          blocks,
          lessonsComing: held,
          lessonsToPrepare: false,
          minutes: { left: 30 },
        }),
      ).toBe(segments);
    },
  );
});

describe(getFoldMinutes, () => {
  it.each([240, 35.3])("omits time when only Plus lessons are folded (left: %s)", (left) => {
    expect(
      getFoldMinutes({
        hasHiddenRows: false,
        left,
        shown: Array.from({ length: 5 }, () => step(7, "pending")),
      }),
    ).toBeUndefined();
  });

  it("puts the held time inside the fold, past the rows shown above it", () => {
    expect(
      getFoldMinutes({ hasHiddenRows: true, left: 240, shown: SIXTEEN_LESSONS.slice(0, 7) }),
    ).toBe(211);
  });

  it("never goes below zero", () => {
    expect(
      getFoldMinutes({ hasHiddenRows: true, left: 10, shown: SIXTEEN_LESSONS.slice(0, 7) }),
    ).toBe(0);
  });
});
