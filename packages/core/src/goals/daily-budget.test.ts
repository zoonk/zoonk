import { describe, expect, it } from "vitest";
import { getBudgetForMainGoal, splitDailyBudget } from "./daily-budget";

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

describe(getBudgetForMainGoal, () => {
  it("gives the main goal exactly its time from the least day that does", () => {
    expect(getBudgetForMainGoal({ count: 1, main: 45 })).toBe(45);
    expect(getBudgetForMainGoal({ count: 2, main: 40 })).toBe(55);
    expect(getBudgetForMainGoal({ count: 2, main: 50 })).toBe(70);
    expect(getBudgetForMainGoal({ count: 3, main: 30 })).toBe(50);
  });

  it("never suggests a day shorter than every goal's minimum, so the saved times add up to it", () => {
    expect(getBudgetForMainGoal({ count: 2, main: 5 })).toBe(10);
    expect(getBudgetForMainGoal({ count: 3, main: 5 })).toBe(15);

    for (const count of [1, 2, 3]) {
      for (const main of [5, 10, 15, 40]) {
        const budget = getBudgetForMainGoal({ count, main });
        const shares = splitDailyBudget({ budget, count });

        expect(shares[0]).toBe(main);
        expect(shares.reduce((sum, minutes) => sum + minutes, 0)).toBe(budget);
      }
    }
  });

  it("finds a day for every time the main goal can get", () => {
    const times = Array.from({ length: 288 }, (_, index) => (index + 1) * 5);

    for (const count of [2, 3, 4]) {
      const mains = times.map(
        (main) => splitDailyBudget({ budget: getBudgetForMainGoal({ count, main }), count })[0],
      );

      expect(mains).toStrictEqual(times);
    }
  });
});
