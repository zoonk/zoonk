import { describe, expect, it } from "vitest";
import { countDecimalPlaces, isRoundedAnswer } from "./rounded-answer";

function rounded(value: number, expected = 11.88): boolean {
  return isRoundedAnswer({ expected, value });
}

describe(countDecimalPlaces, () => {
  it("counts the places a number has as typed, exponents included", () => {
    expect([2, 0.667, 11.9, -3.25, 1e-7].map((value) => countDecimalPlaces(value))).toStrictEqual([
      0, 3, 1, 2, 7,
    ]);
  });
});

describe(isRoundedAnswer, () => {
  it("takes the answer rounded to the places the learner typed", () => {
    expect([12, 11.9, 11.88].map((value) => rounded(value))).toStrictEqual([true, true, true]);
    expect(rounded(-12, -11.88)).toBe(true);
    expect(rounded(2.35, 2.345)).toBe(true);
  });

  it("rejects other numbers at the places typed", () => {
    expect([11, 13, 11.8, 11.87].map((value) => rounded(value))).toStrictEqual([
      false,
      false,
      false,
      false,
    ]);

    expect(rounded(11.88, 12)).toBe(false);
  });

  it("needs two significant digits, so a number rounded too far isn't right", () => {
    expect(rounded(10)).toBe(false);
    expect(rounded(0, 0.4)).toBe(false);
    expect(rounded(0.4, 0.38)).toBe(false);
    expect(rounded(0.38, 0.38)).toBe(true);
    expect(rounded(1200, 1234)).toBe(false);
  });
});
