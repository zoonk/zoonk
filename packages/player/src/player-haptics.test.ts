import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { describe, expect, test } from "vitest";
import { type PlayerHapticSnapshot, getPlayerHapticSequence } from "./player-haptics";
import { type StepResult } from "./player-reducer";

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

function buildResult(overrides: Partial<StepResult> = {}): StepResult {
  return {
    answer: undefined,
    result: { correctAnswer: null, feedback: null, isCorrect: true },
    stepId: "step-1",
    ...overrides,
  };
}

function buildSnapshot(overrides: Partial<PlayerHapticSnapshot> = {}): PlayerHapticSnapshot {
  return {
    phase: "playing",
    result: undefined,
    step: buildStep(),
    ...overrides,
  };
}

describe(getPlayerHapticSequence, () => {
  test("adds a generic success haptic when inline feedback appears", () => {
    const step = buildStep({
      content: {
        answers: ["world"],
        distractors: ["planet"],
        feedback: "Nice",
        question: "Complete the phrase",
        template: "Hello [BLANK]",
      },
      id: "fill-1",
      kind: "fillBlank",
    });

    const sequence = getPlayerHapticSequence({
      current: buildSnapshot({
        phase: "feedback",
        result: buildResult({
          answer: { kind: "fillBlank", userAnswers: ["world"] },
          result: { correctAnswer: null, feedback: "Nice", isCorrect: true },
          stepId: "fill-1",
        }),
        step,
      }),
      milestoneKind: "activity",
      previous: buildSnapshot({ step }),
    });

    expect(sequence).toEqual(["success"]);
  });

  test("adds a generic error haptic when feedback screen appears for a wrong answer", () => {
    const step = buildStep({
      content: {
        kind: "core" as const,
        options: [
          { feedback: "Nope", id: "a", isCorrect: false, text: "A" },
          { feedback: "Yes", id: "b", isCorrect: true, text: "B" },
        ],
        question: "Choose",
      },
      id: "mc-1",
      kind: "multipleChoice",
    });

    const sequence = getPlayerHapticSequence({
      current: buildSnapshot({
        phase: "feedback",
        result: buildResult({
          answer: { kind: "multipleChoice", selectedOptionId: "a" },
          result: { correctAnswer: null, feedback: "Nope", isCorrect: false },
          stepId: "mc-1",
        }),
        step,
      }),
      milestoneKind: "activity",
      previous: buildSnapshot({ step }),
    });

    expect(sequence).toEqual(["error"]);
  });

  test("uses a stronger celebration for lesson completion", () => {
    const sequence = getPlayerHapticSequence({
      current: buildSnapshot({ phase: "completed" }),
      milestoneKind: "lesson",
      previous: buildSnapshot({ phase: "playing" }),
    });

    expect(sequence).toEqual([
      [
        { duration: 30, intensity: 0.6 },
        { delay: 45, duration: 45, intensity: 0.9 },
        { delay: 70, duration: 80, intensity: 1 },
      ],
    ]);
  });
});
