import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { describe, expect, test } from "vitest";
import { computeLocalCompletion } from "./player-completion";
import { type PlayerState, type StepResult } from "./player-reducer";

function buildStep(overrides: Partial<SerializedStep> = {}): SerializedStep {
  return {
    content: { text: "Hello", title: "Intro", variant: "text" as const },
    fillBlankOptions: [],
    id: "step-1",
    kind: "static",
    matchColumnsRightItems: [],
    position: 0,
    sentence: null,
    sentenceWordOptions: [],
    sortOrderItems: [],
    translationOptions: [],
    vocabularyOptions: [],
    word: null,
    wordBankOptions: [],
    ...overrides,
  };
}

function buildState(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    activityId: "activity-1",
    activityKind: "quiz",
    completion: null,
    currentStepIndex: 0,
    phase: "completed",
    results: {},
    selectedAnswers: {},
    startedAt: 1000,
    stepStartedAt: 1000,
    stepTimings: {},
    steps: [buildStep()],
    totalBrainPower: 0,
    ...overrides,
  };
}

describe(computeLocalCompletion, () => {
  test("uses standard scoring for checked steps", () => {
    const steps = [
      buildStep({
        content: {
          kind: "core" as const,
          options: [{ feedback: "Yes", id: "a", isCorrect: true, text: "A" }],
        },
        id: "mc-1",
        kind: "multipleChoice",
      }),
    ];

    const results: Record<string, StepResult> = {
      "mc-1": {
        answer: { kind: "multipleChoice", selectedOptionId: "a" },
        result: { correctAnswer: null, feedback: "Yes", isCorrect: true },
        stepId: "mc-1",
      },
    };

    const completion = computeLocalCompletion(buildState({ results, steps }));
    expect(completion.brainPower).toBe(10);
    expect(completion.correctCount).toBe(1);
    expect(completion.incorrectCount).toBe(0);
  });
});
