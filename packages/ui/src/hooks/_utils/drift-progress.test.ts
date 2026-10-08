import { describe, expect, it } from "vitest";
import { getDriftedProgress } from "./drift-progress";

describe(getDriftedProgress, () => {
  it("starts where the finished work is", () => {
    expect(getDriftedProgress({ base: 20, elapsedMs: 0, estimatedMs: 30_000, target: 60 })).toBe(
      20,
    );
  });

  it("covers most of the phase by its estimated duration", () => {
    const value = getDriftedProgress({
      base: 20,
      elapsedMs: 30_000,
      estimatedMs: 30_000,
      target: 60,
    });

    expect(value).toBeGreaterThan(50);
    expect(value).toBeLessThan(60);
  });

  it("keeps moving after the estimate without reaching the phase's end", () => {
    const late = getDriftedProgress({
      base: 20,
      elapsedMs: 60_000,
      estimatedMs: 30_000,
      target: 60,
    });

    const later = getDriftedProgress({
      base: 20,
      elapsedMs: 90_000,
      estimatedMs: 30_000,
      target: 60,
    });

    expect(later).toBeGreaterThan(late);
    expect(later).toBeLessThan(60);
  });

  it("paces a long phase slower than a short one", () => {
    const short = getDriftedProgress({
      base: 0,
      elapsedMs: 10_000,
      estimatedMs: 10_000,
      target: 50,
    });

    const long = getDriftedProgress({
      base: 0,
      elapsedMs: 10_000,
      estimatedMs: 60_000,
      target: 50,
    });

    expect(long).toBeLessThan(short);
  });

  it("never shows a full bar before the work is done", () => {
    expect(
      getDriftedProgress({ base: 90, elapsedMs: 600_000, estimatedMs: 5000, target: 100 }),
    ).toBeLessThan(100);
  });

  it("holds still when the bar is already past the phase's end", () => {
    expect(getDriftedProgress({ base: 70, elapsedMs: 5000, estimatedMs: 5000, target: 60 })).toBe(
      70,
    );
  });

  it("uses a default pace without an estimate", () => {
    const value = getDriftedProgress({ base: 0, elapsedMs: 30_000, estimatedMs: null, target: 50 });

    expect(value).toBeGreaterThan(40);
    expect(value).toBeLessThan(50);
  });
});
