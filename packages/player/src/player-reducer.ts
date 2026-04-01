import { parseStepContent } from "@zoonk/core/steps/content-contract";
import { type AnswerResult } from "./check-answer";
import { type CompletionResult } from "./completion-input-schema";
import { computeLocalCompletion } from "./player-completion";
import { buildInitialAnswers } from "./player-initial-state";
import { type SerializedStep } from "./prepare-activity-data";
import { canNavigatePrev, isStaticNavigationStep } from "./step-navigation";

export type PlayerPhase = "playing" | "feedback" | "completed";

export type SelectedAnswer =
  | { kind: "fillBlank"; userAnswers: string[] }
  | { kind: "listening"; arrangedWords: string[] }
  | { kind: "matchColumns"; userPairs: { left: string; right: string }[]; mistakes: number }
  | { kind: "multipleChoice"; selectedIndex: number; selectedText: string }
  | { kind: "reading"; arrangedWords: string[] }
  | { kind: "selectImage"; selectedIndex: number }
  | { kind: "sortOrder"; userOrder: string[] }
  | { kind: "story"; selectedChoiceId: string; selectedText: string }
  | { kind: "translation"; selectedWordId: string; selectedText: string; questionText: string };

export type StepResult = {
  stepId: string;
  answer: SelectedAnswer | undefined;
  result: AnswerResult;
};

export type StepTiming = {
  answeredAt: number;
  dayOfWeek: number;
  durationSeconds: number;
  hourOfDay: number;
};

export type PlayerState = {
  activityId: string;
  completion: CompletionResult | null;
  currentStepIndex: number;
  phase: PlayerPhase;
  results: Record<string, StepResult>;
  selectedAnswers: Record<string, SelectedAnswer>;
  startedAt: number;
  stepStartedAt: number;
  steps: SerializedStep[];
  stepTimings: Record<string, StepTiming>;
  totalBrainPower: number;
};

export type PlayerAction =
  | { type: "SELECT_ANSWER"; stepId: string; answer: SelectedAnswer }
  | { type: "CLEAR_ANSWER"; stepId: string }
  | { type: "CHECK_ANSWER"; stepId: string; result: AnswerResult }
  | { type: "CONTINUE" }
  | { type: "COMPLETE" }
  | { type: "NAVIGATE_STEP"; direction: "next" | "prev" }
  | { type: "RESTART" };

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
    result: action.result,
    stepId: action.stepId,
  };

  const checked: PlayerState = {
    ...state,
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

function completeWith(state: PlayerState): PlayerState {
  const completed: PlayerState = { ...state, phase: "completed" };
  return { ...completed, completion: computeLocalCompletion(completed) };
}

function handleContinue(state: PlayerState): PlayerState {
  if (state.phase !== "feedback") {
    return state;
  }

  const nextIndex = state.currentStepIndex + 1;
  const isLast = nextIndex >= state.steps.length;

  if (isLast) {
    return completeWith(state);
  }

  return {
    ...state,
    currentStepIndex: nextIndex,
    phase: "playing",
    stepStartedAt: Date.now(),
  };
}

/**
 * Checks whether the current step is a story static variant (intro, outcome,
 * debrief). These steps allow forward-only navigation via the "Begin" /
 * "Continue" buttons but not arrow-key navigation.
 */
function isStoryStaticStep(step: SerializedStep | undefined): boolean {
  if (!step || step.kind !== "static") {
    return false;
  }

  const content = parseStepContent("static", step.content);

  return content.variant === "storyIntro" || content.variant === "storyOutcome";
}

function handleNavigateStep(
  state: PlayerState,
  action: Extract<PlayerAction, { type: "NAVIGATE_STEP" }>,
): PlayerState {
  if (state.phase !== "playing") {
    return state;
  }

  const currentStep = state.steps[state.currentStepIndex];

  /**
   * Story static steps (intro, outcome, debrief) allow forward-only
   * navigation via the bottom bar action buttons. They don't participate
   * in arrow-key navigation handled by `isStaticNavigationStep`.
   */
  if (isStoryStaticStep(currentStep) && action.direction === "next") {
    const nextIndex = state.currentStepIndex + 1;

    if (nextIndex >= state.steps.length) {
      return completeWith(state);
    }

    return { ...state, currentStepIndex: nextIndex, stepStartedAt: Date.now() };
  }

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
    return completeWith(state);
  }

  return { ...state, currentStepIndex: nextIndex, stepStartedAt: Date.now() };
}

function handleRestart(state: PlayerState): PlayerState {
  const now = Date.now();

  return {
    ...state,
    completion: null,
    currentStepIndex: 0,
    phase: "playing",
    results: {},
    selectedAnswers: buildInitialAnswers(state.steps),
    startedAt: now,
    stepStartedAt: now,
    stepTimings: {},
  };
}

function handleComplete(state: PlayerState): PlayerState {
  if (state.phase === "completed") {
    return state;
  }

  return completeWith(state);
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

    default:
      return state;
  }
}
