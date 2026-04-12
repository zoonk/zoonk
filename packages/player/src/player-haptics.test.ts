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
    metrics: [],
    phase: "playing",
    result: undefined,
    step: buildStep(),
    storyStaticVariant: null,
    ...overrides,
  };
}

describe(getPlayerHapticSequence, () => {
  test("keeps story consequence haptics for positive feedback", () => {
    const step = buildStep({
      content: {
        choices: [
          {
            alignment: "strong" as const,
            consequence: "Things improve.",
            id: "choice-1",
            metricEffects: [{ effect: "positive" as const, metric: "Morale" }],
            text: "Help",
          },
        ],
        situation: "Choose",
      },
      id: "story-1",
      kind: "story",
    });

    const sequence = getPlayerHapticSequence({
      current: buildSnapshot({
        metrics: [{ metric: "Morale", value: 65 }],
        phase: "feedback",
        result: buildResult({
          answer: { kind: "story", selectedChoiceId: "choice-1", selectedText: "Help" },
          stepId: "story-1",
        }),
        step,
      }),
      milestoneKind: "activity",
      previous: buildSnapshot({
        metrics: [{ metric: "Morale", value: 50 }],
        step,
      }),
    });

    expect(sequence).toEqual(["success"]);
  });

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
          { feedback: "Nope", isCorrect: false, text: "A" },
          { feedback: "Yes", isCorrect: true, text: "B" },
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
          answer: { kind: "multipleChoice", selectedIndex: 0, selectedText: "A" },
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

  test("nudges when the story outcome screen appears", () => {
    const sequence = getPlayerHapticSequence({
      current: buildSnapshot({
        phase: "playing",
        storyStaticVariant: "storyOutcome",
      }),
      milestoneKind: "activity",
      previous: buildSnapshot({ phase: "feedback" }),
    });

    expect(sequence).toEqual(["nudge"]);
  });

  test("nudges when investigation begins", () => {
    const previousStep = buildStep({
      content: { scenario: "An incident happened.", variant: "problem" as const },
      id: "inv-problem",
      kind: "investigation",
    });
    const currentStep = buildStep({
      content: {
        actions: [
          { finding: "CPU spiked.", id: "a1", label: "Check logs", quality: "critical" },
          { finding: "Nothing useful.", id: "a2", label: "Refresh cache", quality: "weak" },
        ],
        variant: "action" as const,
      },
      id: "inv-action",
      kind: "investigation",
    });

    const sequence = getPlayerHapticSequence({
      current: buildSnapshot({ step: currentStep }),
      milestoneKind: "activity",
      previous: buildSnapshot({ step: previousStep }),
    });

    expect(sequence).toEqual(["medium"]);
  });

  test("only celebrates investigation action feedback when the clue is strong", () => {
    const step = buildStep({
      content: {
        actions: [
          { finding: "CPU spiked.", id: "a1", label: "Check logs", quality: "critical" },
          { finding: "Nothing useful.", id: "a2", label: "Refresh cache", quality: "weak" },
        ],
        variant: "action" as const,
      },
      id: "inv-action",
      kind: "investigation",
    });

    const sequence = getPlayerHapticSequence({
      current: buildSnapshot({
        phase: "feedback",
        result: buildResult({
          answer: { kind: "investigation", selectedActionId: "a1", variant: "action" },
          result: { correctAnswer: null, feedback: "CPU spiked.", isCorrect: true },
          stepId: "inv-action",
        }),
        step,
      }),
      milestoneKind: "activity",
      previous: buildSnapshot({ step }),
    });

    expect(sequence).toEqual(["success"]);
  });

  test("uses a softer haptic for a partial investigation call", () => {
    const step = buildStep({
      content: {
        explanations: [
          {
            accuracy: "partial" as const,
            feedback: "Close, but not quite.",
            id: "exp-1",
            text: "Cache stampede",
          },
          { accuracy: "best" as const, feedback: "Exactly right.", id: "exp-2", text: "Deadlock" },
        ],
        variant: "call" as const,
      },
      id: "inv-call",
      kind: "investigation",
    });

    const sequence = getPlayerHapticSequence({
      current: buildSnapshot({
        phase: "feedback",
        result: buildResult({
          answer: { kind: "investigation", selectedExplanationId: "exp-1", variant: "call" },
          result: { correctAnswer: null, feedback: "Close, but not quite.", isCorrect: false },
          stepId: "inv-call",
        }),
        step,
      }),
      milestoneKind: "activity",
      previous: buildSnapshot({ step }),
    });

    expect(sequence).toEqual(["nudge"]);
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
