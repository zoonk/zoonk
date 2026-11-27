import { describe, expect, it } from "vitest";
import { getPlacementBudgetSpent } from "./placement-budget";

describe(getPlacementBudgetSpent, () => {
  it("counts answers regardless of time spent answering", () => {
    const answers = Array.from({ length: 12 }, () => ({ durationMs: 340_000 }));

    expect(getPlacementBudgetSpent([])).toBe(0);
    expect(getPlacementBudgetSpent(answers.slice(0, 4))).toBe(1 / 3);
    expect(getPlacementBudgetSpent(answers)).toBe(1);
  });
});
