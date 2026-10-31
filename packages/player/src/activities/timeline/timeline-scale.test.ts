import { describe, expect, it } from "vitest";
import {
  placedOrder,
  roundedGap,
  snapYear,
  spreadLabels,
  yearLabel,
  yearStep,
  yearTicks,
  yearsBetween,
} from "./timeline-scale";

describe(yearLabel, () => {
  it("writes negative years as BCE and adds CE only when the axis reaches BCE", () => {
    expect(yearLabel(-30, { start: -3000 })).toStrictEqual({ era: "bce", year: 30 });
    expect(yearLabel(1969, { start: -3000 })).toStrictEqual({ era: "ce", year: 1969 });
    expect(yearLabel(1969, { start: 1900 })).toStrictEqual({ era: null, year: 1969 });
  });
});

describe(yearTicks, () => {
  it("gives round years and skips year 0", () => {
    expect(yearTicks(-3000, 2000)).toStrictEqual([-3000, -2000, -1000, 1000, 2000]);
    expect(yearTicks(1900, 2000)).toStrictEqual([1900, 1920, 1940, 1960, 1980, 2000]);
  });
});

describe(yearStep, () => {
  it("moves about a hundredth of the axis in a round number of years", () => {
    expect(yearStep(-3000, 2000)).toBe(50);
    expect(yearStep(1900, 2000)).toBe(1);
    expect(yearStep(1914, 1918)).toBe(1);
  });
});

describe(snapYear, () => {
  it("lands on a step from the start and stays on the axis", () => {
    expect(snapYear(-37, { end: 2000, start: -3000 })).toBe(-50);
    expect(snapYear(2400, { end: 2000, start: -3000 })).toBe(2000);
    expect(snapYear(1917.4, { end: 1920, start: 1910 })).toBe(1917);
  });
});

describe(roundedGap, () => {
  it("rounds big gaps and keeps small ones exact", () => {
    expect(roundedGap(2530)).toBe(2500);
    expect(roundedGap(1998)).toBe(2000);
    expect(roundedGap(66)).toBe(66);
  });
});

describe(yearsBetween, () => {
  it("skips the missing year 0", () => {
    expect(yearsBetween(-1, 1)).toBe(1);
    expect(yearsBetween(1969, -30)).toBe(1998);
    expect(yearsBetween(1914, 1918)).toBe(4);
  });
});

describe(spreadLabels, () => {
  it("pushes close labels apart and keeps them inside", () => {
    expect(
      spreadLabels({ bottom: 300, gap: 40, positions: [100, 110, 290], top: 0 }),
    ).toStrictEqual([100, 140, 290]);

    expect(spreadLabels({ bottom: 100, gap: 40, positions: [95, 90, 99], top: 0 })).toStrictEqual([
      60, 20, 100,
    ]);
  });

  it("leaves labels that don't touch where they are", () => {
    expect(spreadLabels({ bottom: 300, gap: 40, positions: [200, 20], top: 0 })).toStrictEqual([
      200, 20,
    ]);
  });
});

describe(placedOrder, () => {
  it("orders by year, then by when the learner placed them", () => {
    expect(
      placedOrder([
        { id: "moon", year: 1969 },
        { id: "cleo", year: -50 },
        { id: "pyramid", year: -50 },
      ]),
    ).toStrictEqual(["cleo", "pyramid", "moon"]);
  });
});
