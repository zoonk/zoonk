import { describe, expect, it } from "vitest";
import { binomialCount, hashSeed, seededRandom, standardNormal } from "./seeded-random";

function draws(count: number, draw: () => number): number[] {
  return Array.from({ length: count }, draw);
}

describe(seededRandom, () => {
  it("repeats the same numbers for the same seed, between 0 and 1", () => {
    const first = draws(50, seededRandom(42));

    expect(draws(50, seededRandom(42))).toStrictEqual(first);
    expect(draws(50, seededRandom(43))).not.toStrictEqual(first);
    expect(Math.min(...first)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...first)).toBeLessThan(1);
  });
});

describe(hashSeed, () => {
  it("gives the same seed for the same text", () => {
    expect(hashSeed("coins")).toBe(hashSeed("coins"));
    expect(hashSeed("coins")).not.toBe(hashSeed("dice"));
  });
});

describe(standardNormal, () => {
  it("draws values centered on zero with a spread of one", () => {
    const random = seededRandom(7);
    const values = draws(4000, () => standardNormal(random));
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;

    expect(Math.abs(mean)).toBeLessThan(0.05);
    expect(Math.sqrt(variance)).toBeGreaterThan(0.95);
    expect(Math.sqrt(variance)).toBeLessThan(1.05);
  });
});

describe(binomialCount, () => {
  it("counts successes between none and every try, near the expected share", () => {
    const random = seededRandom(3);
    const counts = draws(400, () => binomialCount({ probability: 0.3, random, trials: 50 }));
    const mean = counts.reduce((sum, count) => sum + count, 0) / counts.length;

    expect(Math.min(...counts)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...counts)).toBeLessThanOrEqual(50);
    expect(mean).toBeGreaterThan(14);
    expect(mean).toBeLessThan(16);
  });
});
