import {
  type SerializedActivity,
  type SerializedStep,
} from "@/data/activities/prepare-activity-data";
import { type AnswerResult } from "@zoonk/core/player/check-answer";
import { type ChallengeEffect } from "@zoonk/core/steps/content-contract";

export const PLAYER_STATE_VERSION = 1;

export type PlayerPhase = "playing" | "feedback" | "completed";

export type SelectedAnswer =
  | { kind: "fillBlank"; userAnswers: string[] }
  | { kind: "listening"; arrangedWords: string[] }
  | { kind: "matchColumns"; userPairs: { left: string; right: string }[] }
  | { kind: "multipleChoice"; selectedIndex: number }
  | { kind: "reading"; arrangedWords: string[] }
  | { kind: "selectImage"; selectedIndex: number }
  | { kind: "sortOrder"; userOrder: string[] }
  | { kind: "vocabulary"; selectedWordId: string };

export type StepResult = {
  stepId: string;
  answer: SelectedAnswer | undefined;
  result: AnswerResult;
  effects: ChallengeEffect[];
};

export type DimensionInventory = Record<string, number>;

export type PlayerState = {
  activityId: string;
  steps: SerializedStep[];
  currentStepIndex: number;
  phase: PlayerPhase;
  selectedAnswers: Record<string, SelectedAnswer>;
  results: Record<string, StepResult>;
  dimensions: DimensionInventory;
  version: number;
};

export type PlayerAction =
  | { type: "SELECT_ANSWER"; stepId: string; answer: SelectedAnswer }
  | { type: "CHECK_ANSWER"; stepId: string; result: AnswerResult; effects: ChallengeEffect[] }
  | { type: "CONTINUE" }
  | { type: "COMPLETE" }
  | { type: "NAVIGATE_STEP"; direction: "next" | "prev" };

function effectDelta(impact: ChallengeEffect["impact"]): number {
  if (impact === "positive") {
    return 1;
  }

  if (impact === "negative") {
    return -1;
  }

  return 0;
}

function applyEffects(
  dimensions: DimensionInventory,
  effects: ChallengeEffect[],
): DimensionInventory {
  if (effects.length === 0) {
    return dimensions;
  }

  const next = { ...dimensions };

  for (const effect of effects) {
    next[effect.dimension] = (next[effect.dimension] ?? 0) + effectDelta(effect.impact);
  }

  return next;
}

function isStaticStep(step: SerializedStep): boolean {
  return step.kind === "static";
}

export function createInitialState(activity: SerializedActivity): PlayerState {
  return {
    activityId: activity.id,
    currentStepIndex: 0,
    dimensions: {},
    phase: "playing",
    results: {},
    selectedAnswers: {},
    steps: activity.steps,
    version: PLAYER_STATE_VERSION,
  };
}

function handleSelectAnswer(
  state: PlayerState,
  action: Extract<PlayerAction, { type: "SELECT_ANSWER" }>,
): PlayerState {
  return {
    ...state,
    selectedAnswers: { ...state.selectedAnswers, [action.stepId]: action.answer },
  };
}

function handleCheckAnswer(
  state: PlayerState,
  action: Extract<PlayerAction, { type: "CHECK_ANSWER" }>,
): PlayerState {
  if (state.phase !== "playing") {
    return state;
  }

  const stepResult: StepResult = {
    answer: state.selectedAnswers[action.stepId],
    effects: action.effects,
    result: action.result,
    stepId: action.stepId,
  };

  return {
    ...state,
    dimensions: applyEffects(state.dimensions, action.effects),
    phase: "feedback",
    results: { ...state.results, [action.stepId]: stepResult },
  };
}

function handleContinue(state: PlayerState): PlayerState {
  if (state.phase !== "feedback") {
    return state;
  }

  const nextIndex = state.currentStepIndex + 1;
  const isLast = nextIndex >= state.steps.length;

  return {
    ...state,
    currentStepIndex: isLast ? state.currentStepIndex : nextIndex,
    phase: isLast ? "completed" : "playing",
  };
}

function handleNavigateStep(
  state: PlayerState,
  action: Extract<PlayerAction, { type: "NAVIGATE_STEP" }>,
): PlayerState {
  if (state.phase !== "playing") {
    return state;
  }

  const currentStep = state.steps[state.currentStepIndex];

  if (!currentStep || !isStaticStep(currentStep)) {
    return state;
  }

  if (action.direction === "prev") {
    const prevIndex = Math.max(0, state.currentStepIndex - 1);

    if (prevIndex === state.currentStepIndex) {
      return state;
    }

    return { ...state, currentStepIndex: prevIndex };
  }

  const nextIndex = state.currentStepIndex + 1;

  if (nextIndex >= state.steps.length) {
    return state;
  }

  return { ...state, currentStepIndex: nextIndex };
}

function handleComplete(state: PlayerState): PlayerState {
  if (state.phase === "completed") {
    return state;
  }

  return { ...state, phase: "completed" };
}

export function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case "SELECT_ANSWER":
      return handleSelectAnswer(state, action);

    case "CHECK_ANSWER":
      return handleCheckAnswer(state, action);

    case "CONTINUE":
      return handleContinue(state);

    case "NAVIGATE_STEP":
      return handleNavigateStep(state, action);

    case "COMPLETE":
      return handleComplete(state);

    default:
      return state;
  }
}
