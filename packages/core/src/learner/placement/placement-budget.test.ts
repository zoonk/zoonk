import { describe, expect, it } from "vitest";
import { getPlacementBudgetSpent } from "./placement-budget";

const answers = (count: number, durationMs: number) =>
  Array.from({ length: count }, () => ({ durationMs }));

describe(getPlacementBudgetSpent, () => {
  it("leaves room for a few minutes of questions on the day", () => {
    expect(getPlacementBudgetSpent([])).toBe(0);
    expect(getPlacementBudgetSpent(answers(11, 10_000))).toBeLessThan(1);
  });

  it("is used up at 12 answers or 4 minutes of answering, whichever comes first", () => {
    expect(getPlacementBudgetSpent(answers(12, 1000))).toBe(1);
    expect(getPlacementBudgetSpent(answers(4, 60_000))).toBe(1);
  });

  it("moves with every answer by the further along of the answers and the time", () => {
    expect(getPlacementBudgetSpent(answers(3, 5000))).toBe(0.25);
    expect(getPlacementBudgetSpent(answers(3, 40_000))).toBe(0.5);
  });

  it("counts a question left open for minutes as one minute of answering", () => {
    expect(getPlacementBudgetSpent(answers(1, 340_000))).toBe(0.25);
    expect(getPlacementBudgetSpent(answers(3, 340_000))).toBe(0.75);
    expect(getPlacementBudgetSpent(answers(4, 340_000))).toBe(1);
  });
});
