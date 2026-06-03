// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { describe, expect, it, vi } from "vitest";
import { type PlayerState } from "./player-reducer";
import { usePlayerActions } from "./use-player-actions";

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
    phase: "playing",
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

describe(usePlayerActions, () => {
  it("check still no-ops for unanswered interactive steps", () => {
    const dispatch = vi.fn();
    const onComplete = vi.fn();

    const state = buildState({
      steps: [
        buildStep({
          content: {
            options: [{ feedback: "Correct", id: "A", isCorrect: true, text: "A" }],
            question: "Choose",
          },
          kind: "multipleChoice",
        }),
      ],
    });

    const { result } = renderHook(() => usePlayerActions({ dispatch, onComplete, state }));

    act(() => {
      result.current.check();
    });

    expect(dispatch).not.toHaveBeenCalled();
  });
});
