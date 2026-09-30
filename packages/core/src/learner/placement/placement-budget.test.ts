import { describe, expect, it } from "vitest";
import { isPlacementBudgetUsed } from "./placement-budget";

const answers = (count: number, durationMs: number) =>
  Array.from({ length: count }, () => ({ durationMs }));

describe(isPlacementBudgetUsed, () => {
  it("leaves room for a few minutes of questions on the day", () => {
    expect(isPlacementBudgetUsed([])).toBe(false);
    expect(isPlacementBudgetUsed(answers(11, 10_000))).toBe(false);
  });

  it("stops at 12 answers or 4 minutes of answering, whichever comes first", () => {
    expect(isPlacementBudgetUsed(answers(12, 1000))).toBe(true);
    expect(isPlacementBudgetUsed(answers(4, 60_000))).toBe(true);
  });

  it("counts a question left open for minutes as one minute of answering", () => {
    expect(isPlacementBudgetUsed(answers(1, 340_000))).toBe(false);
    expect(isPlacementBudgetUsed(answers(3, 340_000))).toBe(false);
    expect(isPlacementBudgetUsed(answers(4, 340_000))).toBe(true);
  });
});
