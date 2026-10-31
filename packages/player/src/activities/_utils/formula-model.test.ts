import { describe, expect, it } from "vitest";
import {
  eventCombinations,
  othersMoved,
  outputCurve,
  stableDomain,
  startingValues,
} from "./formula-model";

const variables = [
  { initial: 3, max: 6, min: 2, name: "price" },
  { initial: 10, max: 20, min: 0, name: "cost" },
];

describe(startingValues, () => {
  it("puts every slider where it starts", () => {
    expect(startingValues(variables)).toStrictEqual({ cost: 10, price: 3 });
  });
});

describe(othersMoved, () => {
  it("ignores the slider on the chart's axis", () => {
    expect(othersMoved({ except: "price", values: { cost: 10, price: 5 }, variables })).toBe(false);
    expect(othersMoved({ except: "price", values: { cost: 12, price: 3 }, variables })).toBe(true);
  });
});

describe(outputCurve, () => {
  it("sweeps one slider with the others held where they are", () => {
    const curve = outputCurve({
      formula: "price * 100 - cost",
      values: { cost: 20, price: 3 },
      variable: variables[0] ?? { initial: 0, max: 1, min: 0, name: "x" },
    });

    expect(curve[0]).toStrictEqual({ x: 2, y: 180 });
    expect(curve.at(-1)).toStrictEqual({ x: 6, y: 580 });
  });
});

describe(eventCombinations, () => {
  it("lists every on/off combination", () => {
    expect(eventCombinations(["rent", "milk"])).toStrictEqual([
      { milk: 0, rent: 0 },
      { milk: 1, rent: 0 },
      { milk: 0, rent: 1 },
      { milk: 1, rent: 1 },
    ]);

    expect(eventCombinations([])).toStrictEqual([{}]);
  });
});

describe(stableDomain, () => {
  it("covers every curve with round ends", () => {
    expect(
      stableDomain([
        [
          { x: 0, y: 120 },
          { x: 1, y: 1925 },
        ],
        [
          { x: 0, y: -380 },
          { x: 1, y: 1425 },
        ],
      ]),
    ).toStrictEqual([-1000, 2000]);
  });
});
