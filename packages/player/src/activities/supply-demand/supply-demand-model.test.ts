import { describe, expect, it } from "vitest";
import {
  changeDirection,
  chartDomain,
  curveShiftAnswer,
  equilibrium,
  moveCurve,
  shiftLine,
  shiftRange,
} from "./supply-demand-model";

const supply = { intercept: 1, slope: 0.5 };
const demand = { intercept: 10, slope: -1 };

describe(shiftLine, () => {
  it("moves a curve right by giving every price more quantity", () => {
    const moved = shiftLine(supply, -2);

    expect(moved).toStrictEqual({ intercept: 2, slope: 0.5 });
    expect(equilibrium(moved, demand).quantity).toBeCloseTo(16 / 3);
    expect(equilibrium(moved, demand).price).toBeCloseTo(14 / 3);
  });
});

describe(equilibrium, () => {
  it("finds where the curves cross", () => {
    expect(equilibrium(supply, demand)).toStrictEqual({ price: 4, quantity: 6 });
  });

  it("raises the price and lowers the quantity when supply moves left", () => {
    const after = equilibrium(shiftLine(supply, -2), demand);

    expect(after.price).toBeGreaterThan(4);
    expect(after.quantity).toBeLessThan(6);
  });
});

describe(curveShiftAnswer, () => {
  it("names the moved curve and its direction", () => {
    expect(curveShiftAnswer(moveCurve("supply", -1))).toStrictEqual({
      curve: "supply",
      direction: "left",
      kind: "curveShift",
    });

    expect(curveShiftAnswer(moveCurve("demand", 0.5))).toStrictEqual({
      curve: "demand",
      direction: "right",
      kind: "curveShift",
    });
  });

  it("has no answer before anything moves", () => {
    expect(curveShiftAnswer({ demand: 0, supply: 0 })).toBeNull();
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
    const domain = chartDomain({ demand, shift: { amount: 2 }, supply });
    const farthest = equilibrium(supply, shiftLine(demand, 4));

    expect(domain.quantity).toBeGreaterThan(farthest.quantity);
    expect(domain.price).toBeGreaterThan(farthest.price);
  });
});

describe(changeDirection, () => {
  it("tells up, down and no change apart", () => {
    expect(changeDirection(4, 5)).toBe("up");
    expect(changeDirection(4, 3)).toBe("down");
    expect(changeDirection(4, 4 + 1e-12)).toBe("same");
  });
});
