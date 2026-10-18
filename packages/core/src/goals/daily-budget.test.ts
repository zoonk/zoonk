import { describe, expect, it } from "vitest";
import { splitDailyBudget } from "./daily-budget";

describe(splitDailyBudget, () => {
  it("gives the main goal twice each other goal's share and keeps the total", () => {
    expect(splitDailyBudget({ budget: 60, count: 2 })).toStrictEqual([40, 20]);
    expect(splitDailyBudget({ budget: 45, count: 2 })).toStrictEqual([30, 15]);
    expect(splitDailyBudget({ budget: 50, count: 3 })).toStrictEqual([30, 10, 10]);
  });

  it("keeps one goal's time whole and never goes below the minimum", () => {
    expect(splitDailyBudget({ budget: 25, count: 1 })).toStrictEqual([25]);
    expect(splitDailyBudget({ budget: 10, count: 3 })).toStrictEqual([5, 5, 5]);
  });
});
