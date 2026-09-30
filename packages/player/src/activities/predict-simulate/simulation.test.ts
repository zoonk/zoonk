import { describe, expect, it } from "vitest";
import { isHit, outcomeCounts, runSimulation, runningShare } from "./simulation";

const coins = {
  hit: { comparison: "exactly", value: 5 },
  kind: "binomial",
  probability: 0.5,
  trials: 10,
} as const;

describe(runSimulation, () => {
  it("repeats the same runs for the same seed", () => {
    const first = runSimulation({ model: coins, runs: 20, seed: 42 });

    expect(runSimulation({ model: coins, runs: 20, seed: 42 })).toStrictEqual(first);
    expect(runSimulation({ model: coins, runs: 20, seed: 43 })).not.toStrictEqual(first);
  });

  it("stays within each model's possible outcomes", () => {
    const dice = {
      count: 2,
      hit: { comparison: "atLeast", value: 10 },
      kind: "diceSum",
      sides: 6,
    } as const;

    const room = { days: 365, kind: "sharedBirthday", people: 23 } as const;
    const flips = runSimulation({ model: coins, runs: 50, seed: 7 });
    const rolls = runSimulation({ model: dice, runs: 50, seed: 7 });

    expect(Math.min(...flips)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...flips)).toBeLessThanOrEqual(10);
    expect(Math.min(...rolls)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...rolls)).toBeLessThanOrEqual(12);

    expect(new Set(runSimulation({ model: room, runs: 50, seed: 7 }))).toStrictEqual(
      new Set([0, 1]),
    );
  });

  it("lands near the exact chance over many runs", () => {
    const outcomes = runSimulation({ model: coins, runs: 4000, seed: 1234 });
    const share = outcomes.filter((outcome) => isHit(coins, outcome)).length / outcomes.length;

    expect(share).toBeGreaterThan(0.2);
    expect(share).toBeLessThan(0.3);
  });
});

describe(isHit, () => {
  it("compares outcomes the way the model's hit says", () => {
    expect(isHit(coins, 5)).toBe(true);
    expect(isHit(coins, 6)).toBe(false);
    expect(isHit({ ...coins, hit: { comparison: "atLeast", value: 5 } }, 6)).toBe(true);
    expect(isHit({ ...coins, hit: { comparison: "atMost", value: 5 } }, 6)).toBe(false);
    expect(isHit({ days: 365, kind: "sharedBirthday", people: 23 }, 1)).toBe(true);
  });
});

describe(outcomeCounts, () => {
  it("counts every outcome between the smallest and largest, gaps included", () => {
    expect(outcomeCounts([3, 5, 5])).toStrictEqual([
      { count: 1, outcome: 3 },
      { count: 0, outcome: 4 },
      { count: 2, outcome: 5 },
    ]);

    expect(outcomeCounts([])).toStrictEqual([]);
  });
});

describe(runningShare, () => {
  it("tracks the share of hits after each run, thinned for drawing", () => {
    expect(runningShare([true, false, false, true], 4)).toStrictEqual([
      { x: 1, y: 1 },
      { x: 2, y: 0.5 },
      { x: 3, y: 1 / 3 },
      { x: 4, y: 0.5 },
    ]);

    expect(runningShare([true, false, false, true], 2)).toStrictEqual([
      { x: 2, y: 0.5 },
      { x: 4, y: 0.5 },
    ]);
  });
});
