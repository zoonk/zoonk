import { describe, expect, it } from "vitest";
import { apportion, roundToTotal } from "./apportion";

describe(apportion, () => {
  it("shares the total in proportion, the largest remainders taking what's left", () => {
    expect(apportion({ total: 10, weights: [0.8, 0.2] })).toStrictEqual([8, 2]);
    expect(apportion({ total: 10, weights: [1, 1, 1] })).toStrictEqual([4, 3, 3]);
    expect(apportion({ total: 7, weights: [0.5, 0.25, 0.25] })).toStrictEqual([3, 2, 2]);
  });

  it("borrows from the largest share when every part can receive one", () => {
    const weights = [50, 30, 1, 1, 1];
    expect(apportion({ total: 20, weights })).toStrictEqual([12, 7, 1, 0, 0]);

    expect(apportion({ minimumOneIfPossible: true, total: 20, weights })).toStrictEqual([
      10, 7, 1, 1, 1,
    ]);

    expect(apportion({ minimumOneIfPossible: true, total: 3, weights: [100, 1, 1] })).toStrictEqual(
      [1, 1, 1],
    );

    expect(apportion({ minimumOneIfPossible: true, total: 2, weights: [100, 1, 1] })).toStrictEqual(
      [2, 0, 0],
    );
  });

  it("shares equally when no weight counts", () => {
    expect(apportion({ total: 4, weights: [0, 0] })).toStrictEqual([2, 2]);
  });
});

describe(roundToTotal, () => {
  it("rounds each part so the parts add up to the rounded total", () => {
    const rows = roundToTotal([2.4, 3.3, 2.9, 3]);

    expect(rows).toStrictEqual([3, 3, 3, 3]);
    expect(rows.reduce((sum, row) => sum + row, 0)).toBe(Math.round(2.4 + 3.3 + 2.9 + 3));
  });

  it("leaves whole parts as they are", () => {
    expect(roundToTotal([2, 3, 3, 3])).toStrictEqual([2, 3, 3, 3]);
  });

  it("has no parts for no rows", () => {
    expect(roundToTotal([])).toStrictEqual([]);
  });
});
