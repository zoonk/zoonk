import { describe, expect, it } from "vitest";
import { roundOutward } from "./round-outward";

describe(roundOutward, () => {
  it("rounds the low end down and the high end up", () => {
    expect(roundOutward({ high: 26.81, low: 22.79 }, 1)).toStrictEqual({ high: 26.9, low: 22.7 });
    expect(roundOutward({ high: 60.2, low: 53.9 }, 0)).toStrictEqual({ high: 61, low: 53 });
  });

  it("keeps values already on the scale's step, despite floating point", () => {
    expect(roundOutward({ high: 0.3, low: 0.3 }, 1)).toStrictEqual({ high: 0.3, low: 0.3 });
    expect(roundOutward({ high: 18.7, low: 16.6 }, 1)).toStrictEqual({ high: 18.7, low: 16.6 });
  });

  it("leaves one grade for the number format to round, never widening it into a range", () => {
    expect(roundOutward({ high: 48.01, low: 48.01 }, 0)).toStrictEqual({ high: 48.01, low: 48.01 });
  });

  it("keeps a zeroed answer at zero, never negative zero", () => {
    const { high, low } = roundOutward({ high: 0, low: 0 }, 0);

    expect(Object.is(high, 0)).toBe(true);
    expect(Object.is(low, 0)).toBe(true);
  });
});
