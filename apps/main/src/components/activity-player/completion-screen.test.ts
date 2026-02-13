import { type AnswerResult } from "@zoonk/core/player/check-answer";
import { type ChallengeEffect } from "@zoonk/core/steps/content-contract";
import { describe, expect, test } from "vitest";
import { getCompletionScore } from "./completion-screen";
import { type StepResult } from "./player-reducer";

function buildResult(overrides: Partial<StepResult> = {}): StepResult {
  const result: AnswerResult = overrides.result ?? { feedback: null, isCorrect: true };
  const effects: ChallengeEffect[] = overrides.effects ?? [];

  return {
    answer: undefined,
    effects,
    result,
    stepId: "step-1",
    ...overrides,
  };
}

describe(getCompletionScore, () => {
  test("returns null when results are empty (static steps only)", () => {
    expect(getCompletionScore({})).toBeNull();
  });

  test("returns correct count and total for all correct answers", () => {
    const results: Record<string, StepResult> = {
      s1: buildResult({ result: { feedback: null, isCorrect: true }, stepId: "s1" }),
      s2: buildResult({ result: { feedback: null, isCorrect: true }, stepId: "s2" }),
    };

    expect(getCompletionScore(results)).toEqual({ correctCount: 2, totalCount: 2 });
  });

  test("returns correct count and total for mixed answers", () => {
    const results: Record<string, StepResult> = {
      s1: buildResult({ result: { feedback: null, isCorrect: true }, stepId: "s1" }),
      s2: buildResult({ result: { feedback: "Wrong", isCorrect: false }, stepId: "s2" }),
      s3: buildResult({ result: { feedback: null, isCorrect: true }, stepId: "s3" }),
    };

    expect(getCompletionScore(results)).toEqual({ correctCount: 2, totalCount: 3 });
  });

  test("returns zero correct for all incorrect answers", () => {
    const results: Record<string, StepResult> = {
      s1: buildResult({ result: { feedback: "Wrong", isCorrect: false }, stepId: "s1" }),
    };

    expect(getCompletionScore(results)).toEqual({ correctCount: 0, totalCount: 1 });
  });
});
