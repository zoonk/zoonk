import { describe, expect, it } from "vitest";
import { createLinearScale, niceDomain, niceTicks } from "./plot-scale";

describe(createLinearScale, () => {
  it("maps data onto pixels and back, including flipped ranges", () => {
    const scale = createLinearScale({ domain: [0, 10], range: [100, 0] });

    expect(scale.toPixel(0)).toBe(100);
    expect(scale.toPixel(2.5)).toBe(75);
    expect(scale.toValue(75)).toBe(2.5);
  });

  it("puts everything in the middle when the domain is flat", () => {
    expect(createLinearScale({ domain: [5, 5], range: [0, 100] }).toPixel(5)).toBe(50);
  });
});

describe(niceTicks, () => {
  it("returns round ticks inside the domain without float noise", () => {
    expect(niceTicks([0, 100], 4)).toStrictEqual([0, 25, 50, 75, 100]);
    expect(niceTicks([1960, 2020], 3)).toStrictEqual([1960, 1980, 2000, 2020]);
    expect(niceTicks([0, 0.3], 3)).toStrictEqual([0, 0.1, 0.2, 0.3]);
    expect(niceTicks([0, 0.9], 4)).toStrictEqual([0, 0.25, 0.5, 0.75]);
  });
});

describe(niceDomain, () => {
  it("starts at zero when every value is on one side of it, with round ends", () => {
    expect(niceDomain([317, 414])).toStrictEqual([0, 600]);
    expect(niceDomain([-3, 8])).toStrictEqual([-5, 10]);
  });

  it("hugs the data for line charts far from zero", () => {
    expect(niceDomain([317, 414], { includeZero: false })).toStrictEqual([300, 425]);
  });

  it("ignores values that can't be drawn", () => {
    expect(niceDomain([Number.NaN, 4])).toStrictEqual([0, 4]);
    expect(niceDomain([])).toStrictEqual([0, 1]);
    expect(niceDomain([], { includeZero: false })).toStrictEqual([0, 1]);
  });
});
