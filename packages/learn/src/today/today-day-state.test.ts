import { describe, expect, it } from "vitest";
import { type SessionDay, getDayState } from "./today-day-state";

function day(overrides: Partial<SessionDay> = {}): SessionDay {
  return {
    blocks: [
      { id: "review", status: "completed" },
      { id: "lesson", status: "pending" },
    ],
    dailyLimit: null,
    emptyDay: null,
    minutes: { dailyGoal: 45, done: 5, planned: 45 },
    nextBlockId: "lesson",
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

  it("is done once every block is behind the learner", () => {
    expect(
      getDayState(
        day({
          blocks: [
            { id: "review", status: "completed" },
            { id: "lesson", status: "skipped" },
          ],
          nextBlockId: null,
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
          blocks: [{ id: "lesson", status: "completed" }],
          dailyLimit: LIMIT_REACHED,
          nextBlockId: null,
        }),
      ),
    ).toBe("done");
  });

  it("waits while a study day's lessons are still being outlined", () => {
    expect(getDayState(day({ blocks: [], emptyDay: "lessonsComing", nextBlockId: null }))).toBe(
      "waiting",
    );
  });

  it("has nothing new on a study day without blocks", () => {
    expect(getDayState(day({ blocks: [], emptyDay: "nothingNew", nextBlockId: null }))).toBe(
      "ahead",
    );
  });

  it("rests on a day the plan gives no time", () => {
    expect(
      getDayState(
        day({ blocks: [], minutes: { dailyGoal: 0, done: 0, planned: 0 }, nextBlockId: null }),
      ),
    ).toBe("rest");
  });

  it("is not underway when the next block isn't in the day", () => {
    expect(getDayState(day({ blocks: [{ id: "review", status: "completed" }] }))).toBe("done");
  });
});
