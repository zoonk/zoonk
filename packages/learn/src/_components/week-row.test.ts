import { describe, expect, it } from "vitest";
import { getDayShare } from "./week-row";

describe(getDayShare, () => {
  it("fills a finished day, whatever its count", () => {
    expect(getDayShare({ completed: 2, hitGoal: true, total: 3 })).toBe(1);
  });

  it("fills an unfinished day as far as its list is done", () => {
    expect(getDayShare({ completed: 1, hitGoal: false, total: 4 })).toBe(0.25);
  });

  it("leaves a day without a list empty until it's studied", () => {
    expect(getDayShare({ completed: 0, hitGoal: false, total: 0 })).toBe(0);
  });
});
