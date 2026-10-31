import { describe, expect, it } from "vitest";
import { withDayState } from "./day-state";

type Day = Parameters<typeof withDayState>[0];

function day(overrides: Partial<Day> = {}): Day {
  return {
    blocks: [
      { position: 0, status: "completed" },
      { position: 1, status: "pending" },
    ],
    dailyLimit: null,
    emptyDay: null,
    minutes: { dailyGoal: 45, done: 5, planned: 45 },
    nextPosition: 1,
    ...overrides,
  };
}

const LIMIT_REACHED: Day["dailyLimit"] = {
  limitMinutes: 60,
  reached: true,
  remainingMinutes: 0,
  usedMinutes: 60,
};

function dayState(input: Day) {
  return withDayState(input).state;
}

describe(withDayState, () => {
  it("is underway while a block is left to go on with", () => {
    expect(dayState(day())).toBe("underway");
  });

  it("is underway on a day not opened yet, by the next step's place in the day", () => {
    expect(
      dayState(
        day({
          blocks: [
            { position: 0, status: "pending" },
            { position: 1, status: "pending" },
          ],
          nextPosition: 0,
        }),
      ),
    ).toBe("underway");
  });

  it("is done once every block is behind the learner", () => {
    expect(
      dayState(
        day({
          blocks: [
            { position: 0, status: "completed" },
            { position: 1, status: "skipped" },
          ],
          nextPosition: null,
        }),
      ),
    ).toBe("done");
  });

  it("stops at the daily limit with blocks still to do", () => {
    expect(dayState(day({ dailyLimit: LIMIT_REACHED }))).toBe("limit");
  });

  it("is done, not limited, when the limit is reached on the last block", () => {
    expect(
      dayState(
        day({
          blocks: [{ position: 0, status: "completed" }],
          dailyLimit: LIMIT_REACHED,
          nextPosition: null,
        }),
      ),
    ).toBe("done");
  });

  it("waits while a study day's lessons are still being outlined", () => {
    expect(dayState(day({ blocks: [], emptyDay: "lessonsComing", nextPosition: null }))).toBe(
      "waiting",
    );
  });

  it("asks the learner for a study day's lessons nobody is outlining yet", () => {
    expect(dayState(day({ blocks: [], emptyDay: "lessonsToPrepare", nextPosition: null }))).toBe(
      "prepare",
    );
  });

  it("has nothing new on a study day without blocks", () => {
    expect(dayState(day({ blocks: [], emptyDay: "nothingNew", nextPosition: null }))).toBe("ahead");
  });

  it("rests on a day the plan gives no time, the same before and after it's opened", () => {
    const rest = { blocks: [], minutes: { dailyGoal: 0, done: 0, planned: 0 }, nextPosition: null };

    expect(dayState(day({ ...rest, emptyDay: "lessonsComing" }))).toBe("rest");
    expect(dayState(day({ ...rest, emptyDay: null }))).toBe("rest");
  });

  it("rests on a day the plan gives no time", () => {
    expect(
      dayState(
        day({ blocks: [], minutes: { dailyGoal: 0, done: 0, planned: 0 }, nextPosition: null }),
      ),
    ).toBe("rest");
  });

  it("is not underway when the next block isn't in the day", () => {
    expect(dayState(day({ blocks: [{ position: 0, status: "completed" }] }))).toBe("done");
  });
});
