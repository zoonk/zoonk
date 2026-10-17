import { describe, expect, it } from "vitest";
import {
  changeDirection,
  chartDomain,
  crossingPoint,
  lineShiftAnswer,
  moveLine,
  movedLine,
  shiftRange,
  visibleSegment,
} from "./line-crossing-model";

const supply = { intercept: 1, slope: 0.5 };
const demand = { intercept: 10, slope: -1 };
const cost = { intercept: 2000, slope: 5 };
const revenue = { intercept: 0, slope: 15 };

describe(movedLine, () => {
  it("moves a line right by giving every y more x", () => {
    const moved = movedLine(supply, -2, "horizontal");

    expect(moved).toStrictEqual({ intercept: 2, slope: 0.5 });
    expect(crossingPoint(moved, demand).x).toBeCloseTo(16 / 3);
    expect(crossingPoint(moved, demand).y).toBeCloseTo(14 / 3);
  });

  it("moves a line up by adding to every y", () => {
    const higher = movedLine(cost, 500, "vertical");

    expect(higher).toStrictEqual({ intercept: 2500, slope: 5 });
    expect(crossingPoint(higher, revenue)).toStrictEqual({ x: 250, y: 3750 });
  });
});

describe(crossingPoint, () => {
  it("finds where the lines cross", () => {
    expect(crossingPoint(supply, demand)).toStrictEqual({ x: 6, y: 4 });
  });

  it("raises y and lowers x when an upward line moves left", () => {
    const after = crossingPoint(movedLine(supply, -2, "horizontal"), demand);

    expect(after.y).toBeGreaterThan(4);
    expect(after.x).toBeLessThan(6);
  });
});

describe(lineShiftAnswer, () => {
  it("names the moved line and its direction along the shift's axis", () => {
    expect(lineShiftAnswer(moveLine("supply", -1), "horizontal")).toStrictEqual({
      curve: "supply",
      direction: "left",
      kind: "curveShift",
    });

    expect(lineShiftAnswer(moveLine("cost", 100), "vertical")).toStrictEqual({
      curve: "cost",
      direction: "up",
      kind: "curveShift",
    });
  });

  it("has no answer before anything moves", () => {
    expect(lineShiftAnswer({}, "horizontal")).toBeNull();
    expect(lineShiftAnswer({ demand: 0, supply: 0 }, "horizontal")).toBeNull();
  });
});

describe(shiftRange, () => {
  it("reaches the real shift in whole steps", () => {
    const range = shiftRange(2);

    expect(range).toStrictEqual({ max: 4, min: -4, step: 0.5 });
    expect(Number.isInteger(2 / range.step)).toBe(true);
  });
});

describe(chartDomain, () => {
  it("fits every crossing the learner can reach", () => {
    const domain = chartDomain({ amount: 2, axis: "horizontal", lines: [supply, demand] });
    const farthest = crossingPoint(supply, movedLine(demand, 4, "horizontal"));

    expect(domain.x).toBeGreaterThan(farthest.x);
    expect(domain.y).toBeGreaterThan(farthest.y);
  });

  it("fits a line moved up as far as it goes", () => {
    const domain = chartDomain({ amount: 500, axis: "vertical", lines: [cost, revenue] });
    const farthest = crossingPoint(movedLine(cost, 1000, "vertical"), revenue);

    expect(domain.x).toBeGreaterThan(farthest.x);
    expect(domain.y).toBeGreaterThan(farthest.y);
  });
});

describe(visibleSegment, () => {
  it("keeps a line inside the chart, and draws a flat line across it", () => {
    expect(visibleSegment(demand, { x: 20, y: 20 })).toStrictEqual({
      from: { x: 0, y: 10 },
      to: { x: 10, y: 0 },
    });

    expect(visibleSegment({ intercept: 3, slope: 0 }, { x: 8, y: 5 })).toStrictEqual({
      from: { x: 0, y: 3 },
      to: { x: 8, y: 3 },
    });
  });
});

describe(changeDirection, () => {
  it("tells up, down and no change apart", () => {
    expect(changeDirection(4, 5)).toBe("up");
    expect(changeDirection(4, 3)).toBe("down");
    expect(changeDirection(4, 4 + 1e-12)).toBe("same");
  });
});
