import { describe, expect, it } from "vitest";
import {
  SCALE_POSITIONS,
  compareGuess,
  roundGuess,
  scaleTicks,
  shareOfValue,
  valueAtPosition,
} from "./guess-scale";

const log = { max: 3650, min: 1, scale: "log" } as const;
const linear = { max: 100, min: 0, scale: "linear" } as const;

describe(valueAtPosition, () => {
  it("spreads a log scale evenly across powers of ten", () => {
    expect(valueAtPosition(log, 0)).toBe(1);
    expect(valueAtPosition(log, SCALE_POSITIONS)).toBeCloseTo(3650);
    expect(valueAtPosition({ ...log, max: 100 }, SCALE_POSITIONS / 2)).toBeCloseTo(10);
  });

  it("spreads a linear scale evenly", () => {
    expect(valueAtPosition(linear, SCALE_POSITIONS / 4)).toBe(25);
  });
});

describe(shareOfValue, () => {
  it("is the inverse of the position and clamps to the ends", () => {
    expect(shareOfValue({ ...log, max: 100 }, 10)).toBeCloseTo(0.5);
    expect(shareOfValue(linear, 150)).toBe(1);
    expect(shareOfValue(log, 0.01)).toBe(0);
  });
});

describe(roundGuess, () => {
  it("keeps two significant digits", () => {
    expect(roundGuess(2871.3)).toBe(2900);
    expect(roundGuess(0.03471)).toBe(0.035);
    expect(roundGuess(0)).toBe(0);
  });
});

describe(scaleTicks, () => {
  it("labels powers of ten on a log scale", () => {
    expect(scaleTicks(log)).toStrictEqual([1, 10, 100, 1000]);
  });

  it("labels both ends of a linear scale with round steps between", () => {
    expect(scaleTicks(linear)).toStrictEqual([0, 25, 50, 75, 100]);
    expect(scaleTicks({ max: 30, min: 1, scale: "linear" })).toStrictEqual([1, 10, 20, 30]);
    expect(scaleTicks({ max: 21, min: 1, scale: "linear" })).toStrictEqual([1, 5, 10, 15, 21]);
  });
});

describe(compareGuess, () => {
  it("says how many times too big or too small a guess is", () => {
    expect(compareGuess(92, 11.57)).toStrictEqual({ kind: "tooBig", times: 8 });
    expect(compareGuess(2, 11.57)).toStrictEqual({ kind: "tooSmall", times: 5.8 });
  });

  it("calls a guess within half again of the real value close", () => {
    expect(compareGuess(15, 11.57)).toStrictEqual({ kind: "close" });
  });

  it("falls back to the difference when there's no ratio", () => {
    expect(compareGuess(-4, 3)).toStrictEqual({ difference: -7, kind: "off" });
    expect(compareGuess(0, 0)).toStrictEqual({ kind: "close" });
  });
});
