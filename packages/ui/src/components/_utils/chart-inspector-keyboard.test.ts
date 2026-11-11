import { describe, expect, it } from "vitest";
import { getChartPointTargetIndex } from "./chart-inspector-keyboard";

describe(getChartPointTargetIndex, () => {
  it.each([
    { currentIndex: 3, key: "ArrowLeft", targetIndex: 2 },
    { currentIndex: 3, key: "ArrowRight", targetIndex: 4 },
    { currentIndex: 3, key: "Home", targetIndex: 0 },
    { currentIndex: 3, key: "End", targetIndex: 6 },
  ] as const)("moves $key along the row", ({ currentIndex, key, targetIndex }) => {
    expect(getChartPointTargetIndex({ currentIndex, key, totalPoints: 7 })).toBe(targetIndex);
  });

  it.each([
    { currentIndex: 0, key: "ArrowLeft" },
    { currentIndex: 6, key: "ArrowRight" },
  ] as const)("stays on the current point when $key reaches an end", ({ currentIndex, key }) => {
    expect(getChartPointTargetIndex({ currentIndex, key, totalPoints: 7 })).toBe(currentIndex);
  });

  it("ignores keys that do not move between points", () => {
    expect(getChartPointTargetIndex({ currentIndex: 3, key: "Enter", totalPoints: 7 })).toBeNull();
  });
});
