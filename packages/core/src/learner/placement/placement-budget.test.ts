import { describe, expect, it } from "vitest";
import { getPlacementBudgetSpent } from "./placement-budget";

const answers = (count: number, durationMs: number) =>
  Array.from({ length: count }, () => ({ durationMs }));

describe(getPlacementBudgetSpent, () => {
  it("leaves room for a few minutes of questions on the day", () => {
    expect(getPlacementBudgetSpent({ answers: [] })).toBe(0);
    expect(getPlacementBudgetSpent({ answers: answers(11, 10_000) })).toBeLessThan(1);
  });

  it("is used up at 12 answers or 4 minutes of answering, whichever comes first", () => {
    expect(getPlacementBudgetSpent({ answers: answers(12, 1000) })).toBe(1);
    expect(getPlacementBudgetSpent({ answers: answers(4, 60_000) })).toBe(1);
  });

  it("moves with every answer by the further along of the answers and the time", () => {
    expect(getPlacementBudgetSpent({ answers: answers(3, 5000) })).toBe(0.25);
    expect(getPlacementBudgetSpent({ answers: answers(3, 40_000) })).toBe(0.5);
  });

  it("counts a question left open for minutes as one minute of answering", () => {
    expect(getPlacementBudgetSpent({ answers: answers(1, 340_000) })).toBe(0.25);
    expect(getPlacementBudgetSpent({ answers: answers(3, 340_000) })).toBe(0.75);
    expect(getPlacementBudgetSpent({ answers: answers(4, 340_000) })).toBe(1);
  });

  it("has room for an answer on every topic of the learner's own material", () => {
    expect(getPlacementBudgetSpent({ answers: answers(12, 15_000), topics: 14 })).toBeLessThan(1);
    expect(getPlacementBudgetSpent({ answers: answers(9, 40_000), topics: 9 })).toBe(1);
    expect(getPlacementBudgetSpent({ answers: answers(8, 40_000), topics: 9 })).toBeLessThan(1);
  });
});
