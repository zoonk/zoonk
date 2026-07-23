import { describe, expect, it } from "vitest";
import { getContributionCalendarTargetIndex } from "./contribution-calendar-keyboard";

describe(getContributionCalendarTargetIndex, () => {
  it.each([
    { currentIndex: 9, key: "ArrowUp", targetIndex: 8 },
    { currentIndex: 9, key: "ArrowDown", targetIndex: 10 },
    { currentIndex: 9, key: "ArrowLeft", targetIndex: 2 },
    { currentIndex: 9, key: "ArrowRight", targetIndex: 16 },
  ] as const)("moves $key through the calendar grid", ({ currentIndex, key, targetIndex }) => {
    expect(getContributionCalendarTargetIndex({ currentIndex, key, totalDays: 21 })).toBe(
      targetIndex,
    );
  });

  it.each([
    { currentIndex: 7, key: "ArrowUp" },
    { currentIndex: 13, key: "ArrowDown" },
    { currentIndex: 3, key: "ArrowLeft" },
    { currentIndex: 17, key: "ArrowRight" },
  ] as const)("stays on the current day when $key reaches an edge", ({ currentIndex, key }) => {
    expect(getContributionCalendarTargetIndex({ currentIndex, key, totalDays: 18 })).toBe(
      currentIndex,
    );
  });

  it("ignores keys that do not navigate the calendar", () => {
    expect(
      getContributionCalendarTargetIndex({ currentIndex: 9, key: "Enter", totalDays: 21 }),
    ).toBeNull();
  });
});
