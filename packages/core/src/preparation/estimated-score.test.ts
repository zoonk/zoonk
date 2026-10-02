import { describe, expect, it } from "vitest";
import { estimateScoreRange } from "./estimated-score";

const mock = (correct: number, day: string, total = 45) => ({
  correct,
  endedAt: new Date(day),
  total,
});

describe(estimateScoreRange, () => {
  it("has no estimate before a first mock", () => {
    expect(estimateScoreRange([])).toBeNull();
  });

  it("estimates a range around the share of right answers, never a single number", () => {
    const estimate = estimateScoreRange([mock(27, "2026-09-13")]);

    expect(estimate).toMatchObject({ mocks: 1, scale: "percent" });
    expect(estimate?.low).toBeLessThan(60);
    expect(estimate?.high).toBeGreaterThan(60);
  });

  it("narrows as more mocks are taken", () => {
    const one = estimateScoreRange([mock(27, "2026-09-06")]);

    const three = estimateScoreRange([
      mock(27, "2026-09-06"),
      mock(27, "2026-09-13"),
      mock(27, "2026-09-20"),
    ]);

    expect((three?.high ?? 0) - (three?.low ?? 0)).toBeLessThan((one?.high ?? 0) - (one?.low ?? 0));
  });

  it("stays within 0 to 100", () => {
    expect(estimateScoreRange([mock(45, "2026-09-13")])).toMatchObject({ high: 100 });
    expect(estimateScoreRange([mock(0, "2026-09-13")])).toMatchObject({ low: 0 });
  });
});
