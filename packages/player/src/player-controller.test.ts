import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { describe, expect, test } from "vitest";
import { buildCompletionInput, getPlayerTransition } from "./player-controller";
import { type PlayerAction, type PlayerState } from "./player-reducer";

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
    phase: "playing",
    results: {},
    selectedAnswers: {},
    startedAt: 1000,
    stepStartedAt: 2000,
    stepTimings: {},
    steps: [buildStep()],
    totalBrainPower: 0,
    ...overrides,
  };
}

describe(getPlayerTransition, () => {
  test("marks persistence when feedback continues into completion", () => {
    const state = buildState({
      phase: "feedback",
      steps: [buildStep()],
    });

    const transition = getPlayerTransition(state, { type: "CONTINUE" });

    expect(transition.nextState.phase).toBe("completed");
    expect(transition.shouldPersistCompletion).toBe(true);
  });

  test("marks persistence when static navigation reaches the last step", () => {
    const steps = [buildStep({ id: "step-1" }), buildStep({ id: "step-2", position: 1 })];
    const state = buildState({
      currentStepIndex: 1,
      steps,
    });

    const transition = getPlayerTransition(state, {
      direction: "next",
      type: "NAVIGATE_STEP",
    });

    expect(transition.nextState.phase).toBe("completed");
    expect(transition.shouldPersistCompletion).toBe(true);
  });

  test("does not persist completion for non-terminal actions", () => {
    const action: PlayerAction = {
      answer: { kind: "multipleChoice", selectedOptionId: "a" },
      stepId: "step-1",
      type: "SELECT_ANSWER",
    };

    const transition = getPlayerTransition(buildState(), action);

    expect(transition.shouldPersistCompletion).toBe(false);
  });
});

describe(buildCompletionInput, () => {
  test("builds completion payload from the player state", () => {
    const answeredAt = new Date("2026-03-18T15:30:00.000Z").getTime();
    const now = new Date("2026-03-18T18:45:00.000Z");
    const state = buildState({
      selectedAnswers: {
        "step-1": { kind: "multipleChoice", selectedOptionId: "a" },
      },
      stepTimings: {
        "step-1": {
          answeredAt,
          dayOfWeek: 3,
          durationSeconds: 12,
          hourOfDay: 12,
        },
      },
    });

    expect(buildCompletionInput(state, now)).toEqual({
      activityId: "activity-1",
      answers: {
        "step-1": { kind: "multipleChoice", selectedOptionId: "a" },
      },
      localDate: "2026-03-18",
      startedAt: 1000,
      stepTimings: {
        "step-1": {
          answeredAt,
          dayOfWeek: 3,
          durationSeconds: 12,
          hourOfDay: 12,
        },
      },
    });
  });
});
