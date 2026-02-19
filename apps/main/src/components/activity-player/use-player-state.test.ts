// @vitest-environment jsdom
import {
  type SerializedActivity,
  type SerializedStep,
} from "@/data/activities/prepare-activity-data";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { usePlayerState } from "./use-player-state";

function buildStep(overrides: Partial<SerializedStep> = {}): SerializedStep {
  return {
    content: { text: "Hello", title: "Intro", variant: "text" as const },
    fillBlankOptions: [],
    id: "step-1",
    kind: "static",
    matchColumnsRightItems: [],
    position: 0,
    sentence: null,
    sortOrderItems: [],
    visualContent: null,
    visualKind: null,
    vocabularyOptions: [],
    word: null,
    wordBankOptions: [],
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
  test("creates fresh state at step 0", () => {
    const activity = buildActivity();
    const { result } = renderHook(() => usePlayerState(activity));
    expect(result.current.state.phase).toBe("playing");
    expect(result.current.state.currentStepIndex).toBe(0);
    expect(result.current.state.activityId).toBe("activity-1");
  });

  test("dispatch updates state via reducer", () => {
    const activity = buildActivity();
    const { result } = renderHook(() => usePlayerState(activity));

    act(() => {
      result.current.dispatch({
        answer: { kind: "multipleChoice", selectedIndex: 0 },
        stepId: "step-1",
        type: "SELECT_ANSWER",
      });
    });

    expect(result.current.state.selectedAnswers["step-1"]).toEqual({
      kind: "multipleChoice",
      selectedIndex: 0,
    });
  });
});
