import { describe, expect, it } from "vitest";
import {
  createLinearScale,
  fittingTickIndices,
  fittingTicks,
  getChartValueAxis,
  getPlotAxes,
  niceDomain,
  niceTicks,
} from "./plot-scale";

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

  it("stays drawable for values near the largest number, with round ticks where they fit", () => {
    const domain = niceDomain([0, 1.7e308]);

    expect(domain.every((bound) => Number.isFinite(bound))).toBe(true);
    expect(domain[1]).toBeGreaterThanOrEqual(1.7e308);
    expect(niceTicks(domain, 3).every((tick) => Number.isFinite(tick))).toBe(true);
    expect(niceTicks(niceDomain([-1.7e308, 1.7e308]), 3)).toStrictEqual([]);
  });

  it("ignores values that can't be drawn", () => {
    expect(niceDomain([Number.NaN, 4])).toStrictEqual([0, 4]);
    expect(niceDomain([])).toStrictEqual([0, 1]);
    expect(niceDomain([], { includeZero: false })).toStrictEqual([0, 1]);
  });
});

describe(getChartValueAxis, () => {
  it("honors an explicit axis start and filters fractional ticks for whole-number values", () => {
    expect(
      getChartValueAxis({ axisStart: 9, chart: "line", series: [{ values: [9, 10, 11] }] }),
    ).toStrictEqual({ domain: [9, 11], ticks: [9, 10, 11], values: [9, 10, 11] });
  });
});

describe(getPlotAxes, () => {
  it("uses numeric x spacing and includes references only in the y domain", () => {
    const { x, y } = getPlotAxes({
      references: [{ y: 40 }],
      series: [
        {
          points: [
            { x: 10, y: 27 },
            { x: 11, y: 25 },
            { x: 20, y: 30 },
          ],
        },
      ],
    });

    expect(x).toStrictEqual({ domain: [10, 20], ticks: [10, 15, 20] });
    expect(y).toStrictEqual({ domain: [25, 40], ticks: [25, 30, 35, 40] });

    const scale = createLinearScale({ domain: x.domain, range: [0, 100] });

    expect(scale.toPixel(11)).toBe(10);
  });

  it("keeps fractional ticks only when the data has fractions", () => {
    const axes = getPlotAxes({
      references: [],
      series: [
        {
          points: [
            { x: 1, y: 0.5 },
            { x: 10, y: 1.5 },
          ],
        },
      ],
    });

    expect(axes.x.ticks).toStrictEqual([0, 5, 10]);
    expect(axes.y.ticks).toStrictEqual([0.5, 0.75, 1, 1.25, 1.5]);
  });
});

describe("category tick thinning", () => {
  it("keeps uniformly spaced category labels when crowded", () => {
    expect(
      fittingTickIndices([
        { left: 0, right: 14 },
        { left: 20, right: 63 },
        { left: 59, right: 102 },
        { left: 98, right: 141 },
      ]),
    ).toStrictEqual([0, 2]);

    expect(
      fittingTickIndices([
        { left: 0, right: 14 },
        { left: 60, right: 103 },
        { left: 120, right: 163 },
        { left: 180, right: 223 },
      ]),
    ).toStrictEqual([0, 1, 2, 3]);
  });
});

describe("round tick fitting", () => {
  it("lowers the nice count when labels crowd, retaining the readable crossing tick", () => {
    expect(
      fittingTicks({
        domain: [0, 375],
        frame: (value) => {
          const x = (value / 375) * 140;
          return { left: x, right: x + (value === 0 ? 14 : 43) };
        },
      }),
    ).toStrictEqual([0, 200]);

    expect(
      fittingTicks({
        domain: [0, 375],
        frame: (value) => {
          const x = (value / 375) * 400;
          return { left: x, right: x + 25 };
        },
      }),
    ).toStrictEqual([0, 100, 200, 300]);
  });
});
