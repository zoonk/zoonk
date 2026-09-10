import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { describe, expect, it } from "vitest";
import { checkStep } from "./check-step";
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
    completion: null,
    completionMilestoneIndex: null,
    currentStepIndex: 0,
    lessonId: "lesson-1",
    lessonKind: "quiz",
    localDate: "2026-06-05",
    phase: "completed",
    progressSnapshot: null,
    results: {},
    selectedAnswers: {},
    shownCompletionMilestoneKeys: [],
    startedAt: 1000,
    stepStartedAt: 1000,
    stepTimings: {},
    steps: [buildStep()],
    totalBrainPower: 0,
    ...overrides,
  };
}

describe(computeLocalCompletion, () => {
  it("previews 11 correct and 2 wrong answers for nine correct steps and two matches", () => {
    const pairs = [
      { left: "A", right: "1" },
      { left: "B", right: "2" },
    ];

    const step = buildStep({ content: { pairs }, id: "match", kind: "matchColumns" });
    const answer = { kind: "matchColumns" as const, mistakes: 2, userPairs: pairs };

    const results: Record<string, StepResult> = Object.fromEntries(
      Array.from({ length: 9 }, (_, index) => [
        `mc-${index}`,
        { result: { correctAnswer: null, feedback: null, isCorrect: true }, stepId: `mc-${index}` },
      ]),
    );

    const completion = computeLocalCompletion(
      buildState({
        results: {
          ...results,
          [step.id]: { answer, result: checkStep(step, answer).result, stepId: step.id },
        },
      }),
    );

    expect(completion).toMatchObject({ correctCount: 11, energyDelta: 2, incorrectCount: 2 });

    expect(
      Math.round(
        (completion.correctCount / (completion.correctCount + completion.incorrectCount)) * 100,
      ),
    ).toBe(85);
  });

  it("uses standard scoring for checked steps", () => {
    const steps = [
      buildStep({
        content: { options: [{ feedback: "Yes", id: "a", isCorrect: true, text: "A" }] },
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
