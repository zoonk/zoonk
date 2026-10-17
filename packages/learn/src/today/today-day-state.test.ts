import { describe, expect, it } from "vitest";
import { type SessionDay, getDayState, getSessionState } from "./today-day-state";

function day(overrides: Partial<SessionDay> = {}): SessionDay {
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

const LIMIT_REACHED: SessionDay["dailyLimit"] = {
  limitMinutes: 60,
  reached: true,
  remainingMinutes: 0,
  usedMinutes: 60,
};

describe(getDayState, () => {
  it("is underway while a block is left to go on with", () => {
    expect(getDayState(day())).toBe("underway");
  });

  it("is underway on a day not opened yet, by the next step's place in the day", () => {
    expect(
      getDayState(
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
      getDayState(
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
    expect(getDayState(day({ dailyLimit: LIMIT_REACHED }))).toBe("limit");
  });

  it("is done, not limited, when the limit is reached on the last block", () => {
    expect(
      getDayState(
        day({
          blocks: [{ position: 0, status: "completed" }],
          dailyLimit: LIMIT_REACHED,
          nextPosition: null,
        }),
      ),
    ).toBe("done");
  });

  it("waits while a study day's lessons are still being outlined", () => {
    expect(getDayState(day({ blocks: [], emptyDay: "lessonsComing", nextPosition: null }))).toBe(
      "waiting",
    );
  });

  it("has nothing new on a study day without blocks", () => {
    expect(getDayState(day({ blocks: [], emptyDay: "nothingNew", nextPosition: null }))).toBe(
      "ahead",
    );
  });

  it("rests on a day the plan gives no time, the same before and after it's opened", () => {
    const rest = { blocks: [], minutes: { dailyGoal: 0, done: 0, planned: 0 }, nextPosition: null };

    // Not opened yet, the preview may still say lessons are coming; once opened, it says nothing.
    expect(getDayState(day({ ...rest, emptyDay: "lessonsComing" }))).toBe("rest");
    expect(getDayState(day({ ...rest, emptyDay: null }))).toBe("rest");
  });

  it("rests on a day the plan gives no time", () => {
    expect(
      getDayState(
        day({ blocks: [], minutes: { dailyGoal: 0, done: 0, planned: 0 }, nextPosition: null }),
      ),
    ).toBe("rest");
  });

  it("is not underway when the next block isn't in the day", () => {
    expect(getDayState(day({ blocks: [{ position: 0, status: "completed" }] }))).toBe("done");
  });
});

describe(getSessionState, () => {
  it("counts a day still to open as started when it kept work done earlier", () => {
    // A saved day whose replacements wait for the learner's open: its earlier work stays done.
    const state = getSessionState(
      day({
        blocks: [
          { position: 0, status: "completed" },
          { position: 1, status: "pending" },
          { position: 2, status: "pending" },
        ],
        nextPosition: 1,
      }),
    );

    expect(state).toMatchObject({ done: false, started: true });
  });
});
