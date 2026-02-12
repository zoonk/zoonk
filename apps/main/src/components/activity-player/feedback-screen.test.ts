import { type AnswerResult } from "@zoonk/core/player/check-answer";
import { type ChallengeEffect } from "@zoonk/core/steps/content-contract";
import { describe, expect, test } from "vitest";
import { getFeedbackVariant } from "./feedback-screen";
import { type StepResult } from "./player-reducer";

function buildResult(overrides: Partial<StepResult> = {}): StepResult {
  const result: AnswerResult = overrides.result ?? { feedback: "Good job!", isCorrect: true };
  const effects: ChallengeEffect[] = overrides.effects ?? [];

  return {
    answer: undefined,
    effects,
    result,
    stepId: "step-1",
    ...overrides,
  };
}

describe(getFeedbackVariant, () => {
  test("returns correct when isCorrect is true with no effects", () => {
    const result = buildResult({ result: { feedback: null, isCorrect: true } });
    expect(getFeedbackVariant(result)).toBe("correct");
  });

  test("returns incorrect when isCorrect is false with no effects", () => {
    const result = buildResult({ result: { feedback: "Try again", isCorrect: false } });
    expect(getFeedbackVariant(result)).toBe("incorrect");
  });

  test("returns challenge when effects has entries", () => {
    const result = buildResult({
      effects: [{ dimension: "empathy", impact: "positive" }],
      result: { feedback: "You chose wisely", isCorrect: true },
    });
    expect(getFeedbackVariant(result)).toBe("challenge");
  });

  test("returns challenge regardless of isCorrect when effects exist", () => {
    const result = buildResult({
      effects: [{ dimension: "logic", impact: "negative" }],
      result: { feedback: null, isCorrect: false },
    });
    expect(getFeedbackVariant(result)).toBe("challenge");
  });
});
