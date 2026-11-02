import { describe, expect, it } from "vitest";
import { apportion } from "./apportion";

describe(apportion, () => {
  it("shares the total in proportion, the largest remainders taking what's left", () => {
    expect(apportion({ total: 10, weights: [0.8, 0.2] })).toStrictEqual([8, 2]);
    expect(apportion({ total: 10, weights: [1, 1, 1] })).toStrictEqual([4, 3, 3]);
    expect(apportion({ total: 7, weights: [0.5, 0.25, 0.25] })).toStrictEqual([3, 2, 2]);
  });

  it("shares equally when no weight counts", () => {
    expect(apportion({ total: 4, weights: [0, 0] })).toStrictEqual([2, 2]);
  });
});
