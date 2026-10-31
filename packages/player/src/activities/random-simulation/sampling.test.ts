import { describe, expect, it } from "vitest";
import {
  histogram,
  middleRange,
  samplingDomain,
  simulateSamples,
  truthOf,
  valueDigits,
} from "./sampling";

const town = { kind: "proportion", proportion: 0.52 } as const;
const heights = { kind: "mean", mean: 170, sd: 10 } as const;

function width([low, high]: readonly [number, number]): number {
  return high - low;
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function spread(size: number): number {
  return width(middleRange(simulateSamples({ population: heights, runs: 1000, seed: 4, size })));
}

describe(simulateSamples, () => {
  it("replays the same runs for the same seed", () => {
    const first = simulateSamples({ population: town, runs: 50, seed: 9, size: 100 });

    expect(simulateSamples({ population: town, runs: 50, seed: 9, size: 100 })).toStrictEqual(
      first,
    );

    expect(simulateSamples({ population: town, runs: 50, seed: 10, size: 100 })).not.toStrictEqual(
      first,
    );
  });

  it("gives shares between 0 and 1 around the truth, exact or approximated", () => {
    const small = simulateSamples({ population: town, runs: 400, seed: 1, size: 100 });
    const huge = simulateSamples({ population: town, runs: 400, seed: 1, size: 100_000 });

    expect(Math.min(...small, ...huge)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...small, ...huge)).toBeLessThanOrEqual(1);
    expect(average(small)).toBeCloseTo(0.52, 1);
    expect(average(huge)).toBeCloseTo(0.52, 2);
  });

  it("halves the spread when samples are four times bigger", () => {
    const ratio = spread(400) / spread(100);

    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(0.6);
  });
});

describe(middleRange, () => {
  it("drops the lowest and highest 2.5% of results", () => {
    const values = Array.from({ length: 201 }, (_, index) => index);

    expect(middleRange(values)).toStrictEqual([5, 195]);
  });
});

describe(samplingDomain, () => {
  it("centers on the truth, as wide as the smallest samples spread, within 0% and 100%", () => {
    const [low, high] = samplingDomain(town, 100);

    expect((low + high) / 2).toBeCloseTo(truthOf(town));
    expect(samplingDomain({ kind: "proportion", proportion: 0.02 }, 10)[0]).toBe(0);

    expect(width(samplingDomain(heights, 400))).toBeCloseTo(
      width(samplingDomain(heights, 100)) / 2,
    );
  });
});

describe(histogram, () => {
  it("counts every result once, with outliers in the end bins", () => {
    const bins = histogram([0, 0.5, 0.99, 5, -3], [0, 1]);

    expect(bins).toHaveLength(30);
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(5);
    expect(bins[0]?.count).toBe(2);
    expect(bins.at(-1)?.count).toBe(2);
  });
});

describe(valueDigits, () => {
  it("shows whole numbers for wide spreads and decimals for tight ones", () => {
    expect(valueDigits({ margin: 0.05, population: town })).toBe(0);
    expect(valueDigits({ margin: 0.004, population: town })).toBe(1);
    expect(valueDigits({ margin: 0.1, population: heights })).toBe(2);
  });
});
