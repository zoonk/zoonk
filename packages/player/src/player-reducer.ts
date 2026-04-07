import { type AnswerResult } from "./check-answer";
import { type CompletionResult } from "./completion-input-schema";
import { type InvestigationLoopState, isInvestigationScoreVariant } from "./investigation";
import {
  continueFromAction,
  continueFromEvidence,
  continueFromProblem,
  getInvestigationVariant,
  recordActionInLoop,
} from "./investigation-reducer";
import { computeLocalCompletion } from "./player-completion";
import { buildInitialAnswers } from "./player-initial-state";
import { type SerializedStep } from "./prepare-activity-data";
import { canNavigatePrev, isStaticNavigationStep } from "./step-navigation";
import { isStoryStaticVariant } from "./story";

export type PlayerPhase = "playing" | "feedback" | "completed";

export type SelectedAnswer =
  | { kind: "fillBlank"; userAnswers: string[] }
  | { kind: "investigation"; variant: "action"; readyForCall: boolean; selectedActionIndex: number }
  | { kind: "investigation"; variant: "call"; selectedExplanationIndex: number }
  | {
      kind: "investigation";
      variant: "evidence";
      actionIndex: number;
      hunchIndex: number;
      selectedTier: "best" | "dismissive" | "overclaims";
    }
  | { kind: "investigation"; variant: "problem"; selectedExplanationIndex: number }
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
  investigationLoop: InvestigationLoopState | null;
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

  const variant = getInvestigationVariant(currentStep);

  /**
   * Investigation action steps auto-advance like matchColumns.
   * Record the chosen action in the loop state, then immediately continue
   * to the evidence step (or call if readyForCall).
   */
  if (variant === "action") {
    const answer = state.selectedAnswers[action.stepId];
    const loop = state.investigationLoop;

    if (loop && answer) {
      const updatedLoop = recordActionInLoop(loop, answer);
      return handleContinue({ ...checked, investigationLoop: updatedLoop });
    }

    return handleContinue(checked);
  }

  return checked;
}

function completeWith(state: PlayerState): PlayerState {
  const completed: PlayerState = { ...state, phase: "completed" };
  return { ...completed, completion: computeLocalCompletion(completed) };
}

/**
 * Handles the CONTINUE action for investigation steps.
 *
 * Investigation has non-linear step progression:
 * - After problem: init loop, advance to action step
 * - After action (readyForCall=false): advance to evidence step
 * - After action (readyForCall=true): jump to call step
 * - After evidence: record experiment, loop back to action step
 * - After call: advance to score step (triggers completion if last)
 *
 * Returns null if the current step is not an investigation step,
 * signaling the caller to use default continue behavior.
 */
function handleInvestigationContinue(state: PlayerState): PlayerState | null {
  const currentStep = state.steps[state.currentStepIndex];
  const variant = getInvestigationVariant(currentStep);

  if (!variant) {
    return null;
  }

  switch (variant) {
    case "problem":
      return continueFromProblem(state);
    case "action":
      return continueFromAction(state);
    case "evidence":
      return continueFromEvidence(state);
    case "call": {
      const nextIndex = state.currentStepIndex + 1;

      if (nextIndex >= state.steps.length) {
        return completeWith(state);
      }

      return { ...state, currentStepIndex: nextIndex, phase: "playing", stepStartedAt: Date.now() };
    }
    default:
      return null;
  }
}

function handleContinue(state: PlayerState): PlayerState {
  if (state.phase !== "feedback") {
    return state;
  }

  const investigationResult = handleInvestigationContinue(state);

  if (investigationResult) {
    return investigationResult;
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
 * Moves the player to the next step, or completes the activity if there
 * are no more steps. Shared by both story-static and regular-static
 * forward navigation to avoid duplicating the advance-or-complete logic.
 */
function advanceForward(state: PlayerState): PlayerState {
  const nextIndex = state.currentStepIndex + 1;

  if (nextIndex >= state.steps.length) {
    return completeWith(state);
  }

  return { ...state, currentStepIndex: nextIndex, stepStartedAt: Date.now() };
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
  if (currentStep && isStoryStaticVariant(currentStep) && action.direction === "next") {
    return advanceForward(state);
  }

  /**
   * Investigation score step uses a "Continue" button for forward-only
   * navigation, similar to story static variants.
   */
  if (currentStep && isInvestigationScoreVariant(currentStep) && action.direction === "next") {
    return advanceForward(state);
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

  return advanceForward(state);
}

function handleRestart(state: PlayerState): PlayerState {
  const now = Date.now();

  return {
    ...state,
    completion: null,
    currentStepIndex: 0,
    investigationLoop: null,
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
