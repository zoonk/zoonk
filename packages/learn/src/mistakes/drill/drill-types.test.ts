import { describe, expect, it } from "vitest";
import { type ChoiceAnswer } from "../../questions/choice-question";
import { getSentDurationMs } from "./drill-types";

describe(getSentDurationMs, () => {
  const failed: { answer: ChoiceAnswer; durationMs: number } = {
    answer: { selectedIndex: 0 },
    durationMs: 30_000,
  };

  it("keeps the time an unchanged answer took before its save failed", () => {
    expect(getSentDurationMs({ answer: { selectedIndex: 0 }, failed, measuredMs: 90_000 })).toBe(
      30_000,
    );
  });

  it("times a changed answer, or one with no failure before it, from when the question showed", () => {
    expect(getSentDurationMs({ answer: { selectedIndex: 1 }, failed, measuredMs: 90_000 })).toBe(
      90_000,
    );

    expect(getSentDurationMs({ answer: { dontKnow: true }, failed, measuredMs: 90_000 })).toBe(
      90_000,
    );

    expect(
      getSentDurationMs({ answer: { selectedIndex: 0 }, failed: null, measuredMs: 90_000 }),
    ).toBe(90_000);
  });
});
