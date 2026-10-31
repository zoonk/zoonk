import { describe, expect, it } from "vitest";
import { findMostCoverage } from "./most-coverage";

const plateauFrom =
  ({ minutes, share }: { minutes: number; share: number }) =>
  (dailyMinutes: number) => ({ coveredShare: share * Math.min(1, dailyMinutes / minutes) });

const stepAt300 = (dailyMinutes: number) => ({ coveredShare: dailyMinutes >= 300 ? 0.874 : 0.871 });

describe(findMostCoverage, () => {
  it("never shows a 99.6% plateau as everything", () => {
    expect(findMostCoverage(plateauFrom({ minutes: 180, share: 0.996 }))).toStrictEqual({
      coveredShare: 0.99,
      minutes: 180,
    });
  });

  it("finds the least time that reaches the whole day's share, not one that rounds to it", () => {
    expect(findMostCoverage(stepAt300)).toStrictEqual({ coveredShare: 0.87, minutes: 300 });
  });

  it("finds none while a whole day still covers more than half a day", () => {
    expect(findMostCoverage(plateauFrom({ minutes: 1000, share: 0.9 }))).toBeNull();
  });
});
