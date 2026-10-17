import { describe, expect, it } from "vitest";
import { parsePlanChangePayload } from "./plan-change-payload";

describe(parsePlanChangePayload, () => {
  it("reads a falling-behind change saved with the time and date a search found, keeping its facts", () => {
    // A missedDays change saved before falling behind kept only facts.
    const saved = {
      behind: {
        canFocus: true,
        coveredAfter: 0.8,
        coveredBefore: 0.9,
        currentMinutes: 25,
        dailyMinutes: 45,
        fittingDate: "2026-12-01",
        fullDepth: true,
        maximumShare: null,
        measure: "goal",
      },
      days: 3,
      source: "system",
    };

    expect(parsePlanChangePayload(saved).behind).toStrictEqual({
      canFocus: true,
      coveredAfter: 0.8,
      coveredBefore: 0.9,
      currentMinutes: 25,
      measure: "goal",
    });
  });
});
