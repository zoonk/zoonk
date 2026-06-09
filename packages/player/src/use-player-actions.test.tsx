// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getEffectiveCompletionProgressSnapshot,
  getStoredCompletionMilestoneKeys,
} from "./completion-milestone-storage";
import { getLocalDate } from "./player-date";
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
    localDate: "2026-06-05",
    phase: "playing",
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

describe(usePlayerActions, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    globalThis.sessionStorage.clear();
  });

  it("stores shown completion milestone keys before persistence returns", () => {
    globalThis.sessionStorage.clear();

    const dispatch = vi.fn();
    const onComplete = vi.fn();
    const completionDate = new Date(2026, 5, 5, 12);
    const localDate = getLocalDate(completionDate);

    vi.useFakeTimers();
    vi.setSystemTime(completionDate);

    const state = buildState({
      localDate,
      phase: "feedback",
      progressSnapshot: {
        currentEnergy: 9.9,
        fullEnergyDays: 0,
        highestPreviousDailyBrainPower: 100,
        todayBrainPower: 0,
        todayEnergyAtEnd: null,
      },
      results: {
        "step-1": {
          result: { correctAnswer: null, feedback: "Done", isCorrect: true },
          stepId: "step-1",
        },
      },
    });

    const { result } = renderHook(() => usePlayerActions({ dispatch, onComplete, state }));

    act(() => {
      result.current.continue();
    });

    expect(getStoredCompletionMilestoneKeys()).toContain("energy:threshold:10");

    expect(
      getEffectiveCompletionProgressSnapshot({
        localDate,
        progressSnapshot: {
          currentEnergy: 9.9,
          fullEnergyDays: 0,
          highestPreviousDailyBrainPower: 100,
          todayBrainPower: 0,
          todayEnergyAtEnd: null,
        },
      }),
    ).toStrictEqual({
      currentEnergy: 10.1,
      fullEnergyDays: 0,
      highestPreviousDailyBrainPower: 100,
      todayBrainPower: 10,
      todayEnergyAtEnd: 10.1,
    });
  });

  it("falls back to server progress when session storage reads fail", () => {
    const progressSnapshot = {
      currentEnergy: 9.9,
      fullEnergyDays: 0,
      highestPreviousDailyBrainPower: 100,
      todayBrainPower: 0,
      todayEnergyAtEnd: null,
    };

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });

    expect(getStoredCompletionMilestoneKeys()).toStrictEqual([]);

    expect(
      getEffectiveCompletionProgressSnapshot({ localDate: "2026-06-05", progressSnapshot }),
    ).toStrictEqual(progressSnapshot);
  });

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

  it("still persists completion when session storage writes fail", () => {
    const dispatch = vi.fn();
    const onComplete = vi.fn();

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });

    const state = buildState({
      phase: "feedback",
      progressSnapshot: {
        currentEnergy: 9.9,
        fullEnergyDays: 0,
        highestPreviousDailyBrainPower: 100,
        todayBrainPower: 0,
        todayEnergyAtEnd: null,
      },
      results: {
        "step-1": {
          result: { correctAnswer: null, feedback: "Done", isCorrect: true },
          stepId: "step-1",
        },
      },
    });

    const { result } = renderHook(() => usePlayerActions({ dispatch, onComplete, state }));

    act(() => {
      result.current.continue();
    });

    expect(onComplete).toHaveBeenCalledOnce();
  });
});
