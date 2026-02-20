import {
  type SerializedActivity,
  type SerializedStep,
} from "@/data/activities/prepare-activity-data";
import { type AnswerResult } from "@zoonk/core/player/check-answer";
import { type ChallengeEffect, parseStepContent } from "@zoonk/core/steps/content-contract";

export type PlayerPhase = "intro" | "playing" | "feedback" | "completed";

export type SelectedAnswer =
  | { kind: "fillBlank"; userAnswers: string[] }
  | { kind: "listening"; arrangedWords: string[] }
  | { kind: "matchColumns"; userPairs: { left: string; right: string }[]; mistakes: number }
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

export type StepTiming = {
  answeredAt: number;
  dayOfWeek: number;
  durationSeconds: number;
  hourOfDay: number;
};

export type PlayerState = {
  activityId: string;
  currentStepIndex: number;
  dimensions: DimensionInventory;
  phase: PlayerPhase;
  results: Record<string, StepResult>;
  selectedAnswers: Record<string, SelectedAnswer>;
  startedAt: number;
  stepStartedAt: number;
  steps: SerializedStep[];
  stepTimings: Record<string, StepTiming>;
};

type PlayerAction =
  | { type: "SELECT_ANSWER"; stepId: string; answer: SelectedAnswer }
  | { type: "CLEAR_ANSWER"; stepId: string }
  | { type: "CHECK_ANSWER"; stepId: string; result: AnswerResult; effects: ChallengeEffect[] }
  | { type: "CONTINUE" }
  | { type: "COMPLETE" }
  | { type: "NAVIGATE_STEP"; direction: "next" | "prev" }
  | { type: "RESTART" }
  | { type: "START_CHALLENGE" };

export function effectDelta(impact: ChallengeEffect["impact"]): number {
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

function getChallengeEffects(step: SerializedStep): ChallengeEffect[] {
  if (step.kind !== "multipleChoice") {
    return [];
  }

  const content = parseStepContent("multipleChoice", step.content);

  if (content.kind !== "challenge") {
    return [];
  }

  return content.options.flatMap((option) => option.effects);
}

function collectAllDimensions(steps: SerializedStep[]): DimensionInventory {
  const effects = steps.flatMap((step) => getChallengeEffects(step));

  return Object.fromEntries(effects.map((effect) => [effect.dimension, 0]));
}

export function createInitialState(activity: SerializedActivity): PlayerState {
  const dimensions = collectAllDimensions(activity.steps);
  const isChallenge = Object.keys(dimensions).length > 0;
  const now = Date.now();

  return {
    activityId: activity.id,
    currentStepIndex: 0,
    dimensions,
    phase: isChallenge ? "intro" : "playing",
    results: {},
    selectedAnswers: {},
    startedAt: now,
    stepStartedAt: now,
    stepTimings: {},
    steps: activity.steps,
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

  if (!currentStep || !isStaticStep(currentStep)) {
    return state;
  }

  if (action.direction === "prev") {
    const prevIndex = Math.max(0, state.currentStepIndex - 1);

    if (prevIndex === state.currentStepIndex) {
      return state;
    }

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

  return {
    ...state,
    currentStepIndex: 0,
    dimensions: collectAllDimensions(state.steps),
    phase: "playing",
    results: {},
    selectedAnswers: {},
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

    case "START_CHALLENGE":
      return handleStartChallenge(state);

    default:
      return state;
  }
}
