import { describe, expect, it } from "vitest";
import { isPlacementBudgetUsed } from "./placement-budget";

const answers = (count: number, durationMs: number) =>
  Array.from({ length: count }, () => ({ durationMs }));

describe(isPlacementBudgetUsed, () => {
  it("leaves room for a few minutes of questions on the day", () => {
    expect(isPlacementBudgetUsed({ answers: [] })).toBe(false);
    expect(isPlacementBudgetUsed({ answers: answers(11, 10_000) })).toBe(false);
  });

  it("stops at 12 answers or 4 minutes of answering, whichever comes first", () => {
    expect(isPlacementBudgetUsed({ answers: answers(12, 1000) })).toBe(true);
    expect(isPlacementBudgetUsed({ answers: answers(4, 60_000) })).toBe(true);
  });

  it("counts a question left open for minutes as one minute of answering", () => {
    expect(isPlacementBudgetUsed({ answers: answers(1, 340_000) })).toBe(false);
    expect(isPlacementBudgetUsed({ answers: answers(3, 340_000) })).toBe(false);
    expect(isPlacementBudgetUsed({ answers: answers(4, 340_000) })).toBe(true);
  });

  // Pedro's class test has nine topics, days away: its day has room for an answer on each.
  it("has room for an answer on every topic of the learner's own material", () => {
    expect(isPlacementBudgetUsed({ answers: answers(12, 15_000), topics: 14 })).toBe(false);
    expect(isPlacementBudgetUsed({ answers: answers(9, 40_000), topics: 9 })).toBe(true);
    expect(isPlacementBudgetUsed({ answers: answers(8, 40_000), topics: 9 })).toBe(false);
  });
});
