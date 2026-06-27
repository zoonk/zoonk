// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getEffectiveCompletionProgressSnapshot,
  getStoredCompletionMilestoneKeys,
  rememberCompletionProgress,
} from "./completion-milestone-storage";
import { type PlayerProgressSnapshot, getCompletionMilestones } from "./completion-milestones";
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

function buildProgressSnapshot(
  overrides: Partial<PlayerProgressSnapshot> = {},
): PlayerProgressSnapshot {
  return {
    bestDayScores: [],
    currentEnergy: 0,
    fullEnergyDays: 0,
    highestPreviousDailyBrainPower: 0,
    learningDays: 0,
    todayBrainPower: 0,
    todayCompletedLessons: 0,
    todayEnergyAtEnd: null,
    todayInteractiveLessons: 0,
    totalLearningSeconds: 0,
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
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 5, 12));
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
      progressSnapshot: buildProgressSnapshot({
        currentEnergy: 9.9,
        highestPreviousDailyBrainPower: 100,
      }),
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
        progressSnapshot: buildProgressSnapshot({
          currentEnergy: 9.9,
          highestPreviousDailyBrainPower: 100,
        }),
      }),
    ).toStrictEqual({
      bestDayScores: [],
      currentEnergy: 10.1,
      fullEnergyDays: 0,
      highestPreviousDailyBrainPower: 100,
      learningDays: 1,
      todayBrainPower: 10,
      todayCompletedLessons: 1,
      todayEnergyAtEnd: 10.1,
      todayInteractiveLessons: 1,
      totalLearningSeconds: 1800,
    });
  });

  it("falls back to server progress when session storage reads fail", () => {
    const progressSnapshot = buildProgressSnapshot({
      currentEnergy: 9.9,
      fullEnergyDays: 0,
      highestPreviousDailyBrainPower: 100,
      todayBrainPower: 0,
      todayEnergyAtEnd: null,
    });

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });

    expect(getStoredCompletionMilestoneKeys()).toStrictEqual([]);

    expect(
      getEffectiveCompletionProgressSnapshot({ localDate: "2026-06-05", progressSnapshot }),
    ).toStrictEqual(progressSnapshot);
  });

  it("does not show score milestones when stored progress has no server best-day history", () => {
    const localDate = "2026-06-08";

    rememberCompletionProgress({
      completion: {
        brainPower: 10,
        correctCount: 0,
        energyDelta: 0.2,
        incorrectCount: 0,
        lessonDurationSeconds: 60,
      },
      localDate,
      progressSnapshot: buildProgressSnapshot({
        bestDayScores: [{ correctAnswers: 18, dayOfWeek: 2, incorrectAnswers: 2 }],
      }),
    });

    const effectiveSnapshot = getEffectiveCompletionProgressSnapshot({
      localDate,
      progressSnapshot: null,
    });

    const milestones = getCompletionMilestones({
      completion: {
        brainPower: 10,
        completedInteractiveLesson: true,
        correctCount: 1,
        energyDelta: 0.2,
        incorrectCount: 0,
        newTotalBp: 20,
      },
      localDate,
      previousTotalBrainPower: 10,
      progressSnapshot: effectiveSnapshot,
    });

    expect(milestones).not.toContainEqual(
      expect.objectContaining({ kind: "score", status: "bestDay" }),
    );
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
      progressSnapshot: buildProgressSnapshot({
        currentEnergy: 9.9,
        highestPreviousDailyBrainPower: 100,
      }),
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
