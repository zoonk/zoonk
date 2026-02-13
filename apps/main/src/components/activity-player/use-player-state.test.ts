// @vitest-environment jsdom
import {
  type SerializedActivity,
  type SerializedStep,
} from "@/data/activities/prepare-activity-data";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { PLAYER_STATE_VERSION, createInitialState } from "./player-reducer";
import { playerStorageKey, usePlayerState } from "./use-player-state";

function buildStep(overrides: Partial<SerializedStep> = {}): SerializedStep {
  return {
    content: { text: "Hello", title: "Intro", variant: "text" as const },
    id: "step-1",
    kind: "static",
    position: 0,
    sentence: null,
    visualContent: null,
    visualKind: null,
    word: null,
    ...overrides,
  };
}

function buildActivity(overrides: Partial<SerializedActivity> = {}): SerializedActivity {
  return {
    description: null,
    id: "activity-1",
    kind: "core",
    language: "en",
    lessonSentences: [],
    lessonWords: [],
    organizationId: 1,
    steps: [buildStep()],
    title: "Test Activity",
    ...overrides,
  };
}

describe(usePlayerState, () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  describe("initialization", () => {
    test("creates fresh state when no sessionStorage data", () => {
      const activity = buildActivity();
      const { result } = renderHook(() => usePlayerState(activity));
      expect(result.current.state.phase).toBe("playing");
      expect(result.current.state.currentStepIndex).toBe(0);
      expect(result.current.state.activityId).toBe("activity-1");
    });

    test("initial render uses createInitialState even when sessionStorage has data (hydration-safe)", () => {
      const activity = buildActivity({
        steps: [buildStep(), buildStep({ id: "step-2", kind: "multipleChoice", position: 1 })],
      });
      const persisted = {
        ...createInitialState(activity),
        currentStepIndex: 1,
        phase: "feedback" as const,
      };
      sessionStorage.setItem(playerStorageKey(activity.id), JSON.stringify(persisted));

      const renders: number[] = [];

      renderHook(() => {
        const hookResult = usePlayerState(activity);
        renders.push(hookResult.state.currentStepIndex);
        return hookResult;
      });

      // First render (before effects) must use createInitialState for hydration safety
      expect(renders[0]).toBe(0);
      // After effect, state should be restored from sessionStorage
      expect(renders.at(-1)).toBe(1);
    });

    test("discards data with mismatched version", () => {
      const activity = buildActivity();
      const persisted = {
        ...createInitialState(activity),
        currentStepIndex: 1,
        version: 999,
      };
      sessionStorage.setItem(playerStorageKey(activity.id), JSON.stringify(persisted));

      const { result } = renderHook(() => usePlayerState(activity));
      expect(result.current.state.currentStepIndex).toBe(0);
      expect(result.current.state.version).toBe(PLAYER_STATE_VERSION);
    });

    test("discards corrupt (non-JSON) data", () => {
      const activity = buildActivity();
      sessionStorage.setItem(playerStorageKey(activity.id), "not-json{{{");

      const { result } = renderHook(() => usePlayerState(activity));
      expect(result.current.state.phase).toBe("playing");
      expect(result.current.state.currentStepIndex).toBe(0);
    });
  });

  describe("persistence", () => {
    test("writes to sessionStorage after dispatch", () => {
      const activity = buildActivity();
      const { result } = renderHook(() => usePlayerState(activity));

      act(() => {
        result.current.dispatch({
          answer: { kind: "multipleChoice", selectedIndex: 0 },
          stepId: "step-1",
          type: "SELECT_ANSWER",
        });
      });

      const stored = sessionStorage.getItem(playerStorageKey(activity.id));
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.selectedAnswers["step-1"]).toEqual({
        kind: "multipleChoice",
        selectedIndex: 0,
      });
    });

    test("key format is zoonk:player:{activityId}", () => {
      expect(playerStorageKey("abc-123")).toBe("zoonk:player:abc-123");
    });

    test("clears storage when completed", () => {
      const activity = buildActivity({ steps: [buildStep()] });
      const { result } = renderHook(() => usePlayerState(activity));

      act(() => {
        result.current.dispatch({
          effects: [],
          result: { feedback: null, isCorrect: true },
          stepId: "step-1",
          type: "CHECK_ANSWER",
        });
      });

      expect(sessionStorage.getItem(playerStorageKey(activity.id))).not.toBeNull();

      act(() => {
        result.current.dispatch({ type: "CONTINUE" });
      });

      expect(result.current.state.phase).toBe("completed");
      expect(sessionStorage.getItem(playerStorageKey(activity.id))).toBeNull();
    });

    test("persists multiple dispatches correctly", () => {
      const activity = buildActivity();
      const { result } = renderHook(() => usePlayerState(activity));

      act(() => {
        result.current.dispatch({
          answer: { kind: "multipleChoice", selectedIndex: 0 },
          stepId: "step-1",
          type: "SELECT_ANSWER",
        });
      });

      act(() => {
        result.current.dispatch({
          effects: [],
          result: { feedback: "Good!", isCorrect: true },
          stepId: "step-1",
          type: "CHECK_ANSWER",
        });
      });

      const stored = sessionStorage.getItem(playerStorageKey(activity.id));
      const parsed = JSON.parse(stored!);
      expect(parsed.phase).toBe("feedback");
      expect(parsed.results["step-1"].result.isCorrect).toBeTruthy();
    });
  });
});
