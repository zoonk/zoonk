import { type ChallengeEffect } from "@zoonk/core/steps/content-contract";
import { type AnswerResult } from "./check-answer";
import { type CompletionResult } from "./completion-input-schema";
import { IMPACT_DELTA } from "./dimensions";
import {
  type PlayerCompletionState,
  createIdleCompletionState,
  handleRejectCompletion,
  handleResolveCompletion,
  handleSubmitCompletion,
} from "./player-completion";
import { buildInitialAnswers, collectAllDimensions } from "./player-initial-state";
import { type SerializedStep } from "./prepare-activity-data";
import { canNavigatePrev, isStaticNavigationStep } from "./step-navigation";

export type PlayerPhase = "intro" | "playing" | "feedback" | "completed";

export type SelectedAnswer =
  | { kind: "fillBlank"; userAnswers: string[] }
  | { kind: "listening"; arrangedWords: string[] }
  | { kind: "matchColumns"; userPairs: { left: string; right: string }[]; mistakes: number }
  | { kind: "multipleChoice"; selectedIndex: number; selectedText: string }
  | { kind: "reading"; arrangedWords: string[] }
  | { kind: "selectImage"; selectedIndex: number }
  | { kind: "sortOrder"; userOrder: string[] }
  | { kind: "translation"; selectedWordId: string; selectedText: string; questionText: string };

export type StepResult = {
  stepId: string;
  answer: SelectedAnswer | undefined;
  result: AnswerResult;
  effects: ChallengeEffect[];
};

export type DimensionInventory = Record<string, number>;

export type StepTiming = {
  answeredAt: number;
  dayOfWeek: number;
  durationSeconds: number;
  hourOfDay: number;
};

export type PlayerState = {
  activityId: string;
  completion: PlayerCompletionState;
  completionRequestId: number;
  currentStepIndex: number;
  dimensions: DimensionInventory;
  phase: PlayerPhase;
  previousDimensions: DimensionInventory;
  results: Record<string, StepResult>;
  selectedAnswers: Record<string, SelectedAnswer>;
  startedAt: number;
  stepStartedAt: number;
  steps: SerializedStep[];
  stepTimings: Record<string, StepTiming>;
};

export type PlayerAction =
  | { type: "SELECT_ANSWER"; stepId: string; answer: SelectedAnswer }
  | { type: "CLEAR_ANSWER"; stepId: string }
  | { type: "CHECK_ANSWER"; stepId: string; result: AnswerResult; effects: ChallengeEffect[] }
  | { type: "CONTINUE" }
  | { type: "COMPLETE" }
  | { type: "NAVIGATE_STEP"; direction: "next" | "prev" }
  | { type: "RESTART" }
  | { type: "SUBMIT_COMPLETION"; requestId: number }
  | { type: "RESOLVE_COMPLETION"; requestId: number; result: CompletionResult }
  | { type: "REJECT_COMPLETION"; requestId: number }
  | { type: "START_CHALLENGE" };

function applyEffects(
  dimensions: DimensionInventory,
  effects: ChallengeEffect[],
): DimensionInventory {
  if (effects.length === 0) {
    return dimensions;
  }

  const next = { ...dimensions };

  for (const effect of effects) {
    next[effect.dimension] = (next[effect.dimension] ?? 0) + IMPACT_DELTA[effect.impact];
  }

  return next;
}

export { createInitialState } from "./player-initial-state";

function handleSelectAnswer(
  state: PlayerState,
  action: Extract<PlayerAction, { type: "SELECT_ANSWER" }>,
): PlayerState {
  return {
    ...state,
    selectedAnswers: { ...state.selectedAnswers, [action.stepId]: action.answer },
  };
}

function handleClearAnswer(
  state: PlayerState,
  action: Extract<PlayerAction, { type: "CLEAR_ANSWER" }>,
): PlayerState {
  const { [action.stepId]: _, ...rest } = state.selectedAnswers;
  return { ...state, selectedAnswers: rest };
}

function recordStepTiming(state: PlayerState, stepId: string): Record<string, StepTiming> {
  const now = Date.now();
  const answeredDate = new Date(now);

  return {
    ...state.stepTimings,
    [stepId]: {
      answeredAt: now,
      dayOfWeek: answeredDate.getDay(),
      durationSeconds: Math.max(0, Math.round((now - state.stepStartedAt) / 1000)),
      hourOfDay: answeredDate.getHours(),
    },
  };
}

function handleCheckAnswer(
  state: PlayerState,
  action: Extract<PlayerAction, { type: "CHECK_ANSWER" }>,
): PlayerState {
  if (state.phase !== "playing") {
    return state;
  }

  const currentStep = state.steps[state.currentStepIndex];

  const stepResult: StepResult = {
    answer: state.selectedAnswers[action.stepId],
    effects: action.effects,
    result: action.result,
    stepId: action.stepId,
  };

  const checked: PlayerState = {
    ...state,
    dimensions: applyEffects(state.dimensions, action.effects),
    phase: "feedback",
    previousDimensions: state.dimensions,
    results: { ...state.results, [action.stepId]: stepResult },
    stepTimings: recordStepTiming(state, action.stepId),
  };

  // matchColumns validates each pair during interaction, so feedback is redundant.
  if (currentStep?.kind === "matchColumns") {
    return handleContinue(checked);
  }

  return checked;
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
    stepStartedAt: isLast ? state.stepStartedAt : Date.now(),
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

  if (!isStaticNavigationStep(currentStep)) {
    return state;
  }

  if (action.direction === "prev") {
    if (!canNavigatePrev(state.steps, state.currentStepIndex)) {
      return state;
    }

    const prevIndex = state.currentStepIndex - 1;

    return { ...state, currentStepIndex: prevIndex, stepStartedAt: Date.now() };
  }

  const nextIndex = state.currentStepIndex + 1;

  if (nextIndex >= state.steps.length) {
    return { ...state, phase: "completed" };
  }

  return { ...state, currentStepIndex: nextIndex, stepStartedAt: Date.now() };
}

function handleRestart(state: PlayerState): PlayerState {
  const now = Date.now();
  const dimensions = collectAllDimensions(state.steps);

  return {
    ...state,
    completion: createIdleCompletionState(),
    completionRequestId: state.completionRequestId + 1,
    currentStepIndex: 0,
    dimensions,
    phase: "playing",
    previousDimensions: { ...dimensions },
    results: {},
    selectedAnswers: buildInitialAnswers(state.steps),
    startedAt: now,
    stepStartedAt: now,
    stepTimings: {},
  };
}

function handleStartChallenge(state: PlayerState): PlayerState {
  if (state.phase !== "intro") {
    return state;
  }

  return { ...state, phase: "playing" };
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

    case "CLEAR_ANSWER":
      return handleClearAnswer(state, action);

    case "CHECK_ANSWER":
      return handleCheckAnswer(state, action);

    case "CONTINUE":
      return handleContinue(state);

    case "NAVIGATE_STEP":
      return handleNavigateStep(state, action);

    case "COMPLETE":
      return handleComplete(state);

    case "RESTART":
      return handleRestart(state);

    case "SUBMIT_COMPLETION":
      return handleSubmitCompletion(state, action.requestId);

    case "RESOLVE_COMPLETION":
      return handleResolveCompletion(state, action.requestId, action.result);

    case "REJECT_COMPLETION":
      return handleRejectCompletion(state, action.requestId);

    case "START_CHALLENGE":
      return handleStartChallenge(state);

    default:
      return state;
  }
}
