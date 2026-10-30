import { describe, expect, it } from "vitest";
import { getBudgetForGoal, splitDailyBudget } from "./daily-budget";

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

describe(getBudgetForGoal, () => {
  it("gives the main goal exactly its time from the least day that does", () => {
    expect(getBudgetForGoal({ count: 1, minutes: 45, place: 0 })).toBe(45);
    expect(getBudgetForGoal({ count: 2, minutes: 40, place: 0 })).toBe(55);
    expect(getBudgetForGoal({ count: 2, minutes: 50, place: 0 })).toBe(70);
    expect(getBudgetForGoal({ count: 3, minutes: 30, place: 0 })).toBe(50);
  });

  it("never suggests a day shorter than every goal's minimum, so the saved times add up to it", () => {
    expect(getBudgetForGoal({ count: 2, minutes: 5, place: 0 })).toBe(10);
    expect(getBudgetForGoal({ count: 3, minutes: 5, place: 0 })).toBe(15);

    for (const count of [1, 2, 3]) {
      for (const main of [5, 10, 15, 40]) {
        const budget = getBudgetForGoal({ count, minutes: main, place: 0 }) ?? 0;
        const shares = splitDailyBudget({ budget, count });

        expect(shares[0]).toBe(main);
        expect(shares.reduce((sum, minutes) => sum + minutes, 0)).toBe(budget);
      }
    }
  });

  it("finds a day for every time the main goal can get in a day's saved time", () => {
    const times = Array.from({ length: 288 }, (_, index) => (index + 1) * 5);

    for (const count of [2, 3, 4]) {
      const savedMains = new Set(times.map((day) => splitDailyBudget({ budget: day, count })[0]));

      const mains = times.map((main) => {
        const day = getBudgetForGoal({ count, minutes: main, place: 0 });
        return day === null ? null : splitDailyBudget({ budget: day, count })[0];
      });

      expect(mains).toStrictEqual(times.map((main) => (savedMains.has(main) ? main : null)));
    }
  });

  it("suggests no day longer than a day's time can be saved", () => {
    expect(getBudgetForGoal({ count: 1, minutes: 1440, place: 0 })).toBe(1440);
    expect(getBudgetForGoal({ count: 2, minutes: 950, place: 0 })).toBe(1420);
    expect(getBudgetForGoal({ count: 2, minutes: 1000, place: 0 })).toBeNull();
    expect(getBudgetForGoal({ count: 2, minutes: 600, place: 1 })).toBeNull();
  });

  it("gives a goal typed after the main one exactly its time, from the least day that does", () => {
    expect(getBudgetForGoal({ count: 2, minutes: 40, place: 1 })).toBe(120);

    const times = Array.from({ length: 48 }, (_, index) => (index + 1) * 5);

    for (const [count, place] of [
      [2, 1],
      [3, 1],
      [3, 2],
    ] as const) {
      const shares = times.map((minutes) => {
        const budget = getBudgetForGoal({ count, minutes, place }) ?? 0;
        const split = splitDailyBudget({ budget, count });

        return {
          share: split[place],
          sum: split.reduce((total, share) => total + share, 0) === budget,
        };
      });

      expect(shares).toStrictEqual(times.map((share) => ({ share, sum: true })));
    }
  });
});
