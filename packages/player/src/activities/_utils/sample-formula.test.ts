import { describe, expect, it } from "vitest";
import { linePath, sampleFormula } from "./sample-formula";

describe(sampleFormula, () => {
  it("evaluates the formula evenly across the range, both ends included", () => {
    const points = sampleFormula({
      domain: [0, 12],
      formula: "rate * 2",
      samples: 4,
      variable: "rate",
    });

    expect(points).toStrictEqual([
      { x: 0, y: 0 },
      { x: 3, y: 6 },
      { x: 6, y: 12 },
      { x: 9, y: 18 },
      { x: 12, y: 24 },
    ]);
  });

  it("uses fixed values for the other variables and drops points that fail", () => {
    const points = sampleFormula({
      domain: [-1, 1],
      fixed: { scale: 1 },
      formula: "scale / x",
      samples: 2,
      variable: "x",
    });

    expect(points).toStrictEqual([
      { x: -1, y: -1 },
      { x: 1, y: 1 },
    ]);
  });

  it("draws nothing for a formula that doesn't parse", () => {
    expect(sampleFormula({ domain: [0, 1], formula: "2 *", variable: "x" })).toStrictEqual([]);
  });
});

describe(linePath, () => {
  it("moves to the first point and draws lines through the rest", () => {
    expect(
      linePath([
        { x: 0, y: 10 },
        { x: 5, y: 2.5 },
      ]),
    ).toBe("M0.00 10.00 L5.00 2.50");
  });
});
