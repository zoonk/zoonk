import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { describe, expect, it } from "vitest";
import { buildCompletionInput, getPlayerTransition } from "./player-controller";
import { getPlayerStepChangeEvent } from "./player-events";
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
    completion: null,
    currentStepIndex: 0,
    lessonId: "lesson-1",
    lessonKind: "quiz",
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
  it("marks persistence when feedback continues into completion", () => {
    const state = buildState({ phase: "feedback", steps: [buildStep()] });

    const transition = getPlayerTransition(state, { type: "CONTINUE" });

    expect(transition.nextState.phase).toBe("completed");
    expect(transition.shouldPersistCompletion).toBe(true);
  });

  it("marks persistence when static navigation reaches the last step", () => {
    const steps = [buildStep({ id: "step-1" }), buildStep({ id: "step-2", position: 1 })];
    const state = buildState({ currentStepIndex: 1, steps });

    const transition = getPlayerTransition(state, { direction: "next", type: "NAVIGATE_STEP" });

    expect(transition.nextState.phase).toBe("completed");
    expect(transition.shouldPersistCompletion).toBe(true);
  });

  it("does not persist completion for non-terminal actions", () => {
    const action: PlayerAction = {
      answer: { kind: "multipleChoice", selectedOptionId: "a" },
      stepId: "step-1",
      type: "SELECT_ANSWER",
    };

    const transition = getPlayerTransition(buildState(), action);

    expect(transition.shouldPersistCompletion).toBe(false);
  });
});

describe(getPlayerStepChangeEvent, () => {
  it("returns a next-step event when the player advances", () => {
    const steps = [buildStep({ id: "step-1" }), buildStep({ id: "step-2", position: 1 })];
    const state = buildState({ currentStepIndex: 0, steps });
    const transition = getPlayerTransition(state, { direction: "next", type: "NAVIGATE_STEP" });

    expect(getPlayerStepChangeEvent({ nextState: transition.nextState, state })).toStrictEqual({
      direction: "next",
      lessonId: "lesson-1",
      nextStepId: "step-2",
      nextStepIndex: 1,
      previousStepId: "step-1",
      previousStepIndex: 0,
    });
  });

  it("returns a previous-step event when the player goes back", () => {
    const steps = [buildStep({ id: "step-1" }), buildStep({ id: "step-2", position: 1 })];
    const state = buildState({ currentStepIndex: 1, steps });
    const transition = getPlayerTransition(state, { direction: "prev", type: "NAVIGATE_STEP" });

    expect(getPlayerStepChangeEvent({ nextState: transition.nextState, state })).toStrictEqual({
      direction: "prev",
      lessonId: "lesson-1",
      nextStepId: "step-1",
      nextStepIndex: 0,
      previousStepId: "step-2",
      previousStepIndex: 1,
    });
  });

  it("returns null when the transition completes the lesson", () => {
    const state = buildState();
    const transition = getPlayerTransition(state, { direction: "next", type: "NAVIGATE_STEP" });

    expect(getPlayerStepChangeEvent({ nextState: transition.nextState, state })).toBeNull();
  });
});

describe(buildCompletionInput, () => {
  it("builds completion payload from the player state", () => {
    const answeredAt = new Date("2026-03-18T15:30:00.000Z").getTime();
    const now = new Date("2026-03-18T18:45:00.000Z");

    const state = buildState({
      selectedAnswers: { "step-1": { kind: "multipleChoice", selectedOptionId: "a" } },
      stepTimings: { "step-1": { answeredAt, dayOfWeek: 3, durationSeconds: 12, hourOfDay: 12 } },
    });

    expect(buildCompletionInput(state, now)).toStrictEqual({
      answers: { "step-1": { kind: "multipleChoice", selectedOptionId: "a" } },
      lessonId: "lesson-1",
      localDate: "2026-03-18",
      startedAt: 1000,
      stepTimings: { "step-1": { answeredAt, dayOfWeek: 3, durationSeconds: 12, hourOfDay: 12 } },
    });
  });
});
