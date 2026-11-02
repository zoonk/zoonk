import { describe, expect, it } from "vitest";
import { testProgressPercent } from "./test-progress";

describe(testProgressPercent, () => {
  it("keeps an unfinished daily budget below 100 percent", () => {
    expect(testProgressPercent(239 / 240)).toBe(99);
    expect(testProgressPercent(1 - Number.EPSILON)).toBeLessThan(100);
  });

  it("reaches 100 percent when the daily budget is used", () => {
    expect(testProgressPercent(1)).toBe(100);
    expect(testProgressPercent(1.1)).toBe(100);
  });

  it("keeps progress within its lower bound", () => {
    expect(testProgressPercent(0)).toBe(0);
    expect(testProgressPercent(-0.1)).toBe(0);
  });
});
