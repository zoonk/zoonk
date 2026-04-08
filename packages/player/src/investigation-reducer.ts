import { parseStepContent } from "@zoonk/core/steps/contract/content";
import {
  type ActionTiming,
  type InvestigationLoopState,
  getInvestigationStepByVariant,
} from "./investigation";
import { type PlayerState, type SelectedAnswer } from "./player-reducer";
import { type SerializedStep } from "./prepare-activity-data";

export const MAX_EXPERIMENTS = 3;

/**
 * Returns the investigation variant of the current step, or null
 * if the step is not an investigation step.
 */
export function getInvestigationVariant(step: SerializedStep | undefined) {
  if (!step || step.kind !== "investigation") {
    return null;
  }

  const content = parseStepContent("investigation", step.content);
  return content.variant;
}

/**
 * Initializes the investigation loop state when the problem step
 * is checked. The loop tracks which actions the learner has used
 * across the 3 fixed experiments.
 */
function initInvestigationLoop(): InvestigationLoopState {
  return { actionTimings: [], usedActionIndices: [] };
}

/**
 * Records a used action index and its timing in the investigation
 * loop when the action step is checked. The action index is stored
 * for scoring (quality tiers), filtering out used actions on the
 * next visit, and building per-experiment StepAttempts server-side.
 */
export function recordActionInLoop({
  answer,
  loop,
  timing,
}: {
  answer: SelectedAnswer;
  loop: InvestigationLoopState;
  timing: ActionTiming;
}): InvestigationLoopState {
  if (answer.kind !== "investigation" || answer.variant !== "action") {
    return loop;
  }

  return {
    ...loop,
    actionTimings: [...loop.actionTimings, timing],
    usedActionIndices: [...loop.usedActionIndices, answer.selectedActionIndex],
  };
}

/**
 * Removes the selected answer and result for a given step ID.
 *
 * Used when the investigation loop revisits the action step —
 * the previous experiment's answer must be cleared so the component
 * renders a fresh slate instead of showing a stale selection.
 */
function clearStepAnswer(
  state: PlayerState,
  stepId: string | undefined,
): { results: PlayerState["results"]; selectedAnswers: PlayerState["selectedAnswers"] } {
  if (!stepId) {
    return { results: state.results, selectedAnswers: state.selectedAnswers };
  }

  const { [stepId]: _oldAnswer, ...remainingAnswers } = state.selectedAnswers;
  const { [stepId]: _oldResult, ...remainingResults } = state.results;

  return { results: remainingResults, selectedAnswers: remainingAnswers };
}

/** Advances from the investigation problem step to the action step. */
export function continueFromProblem(state: PlayerState): PlayerState {
  const loop = initInvestigationLoop();
  const actionStep = getInvestigationStepByVariant(state.steps, "action");
  const actionIndex = actionStep ? state.steps.indexOf(actionStep) : state.currentStepIndex + 1;

  return {
    ...state,
    currentStepIndex: actionIndex,
    investigationLoop: loop,
    phase: "playing",
    stepStartedAt: Date.now(),
  };
}

/**
 * Handles continuation from the action step after the evidence
 * feedback has been shown.
 *
 * If 3 experiments are done: advance to the call step.
 * Otherwise: clear the action answer and stay on the action step
 * so it re-renders with fewer available actions.
 */
export function continueFromAction(state: PlayerState): PlayerState {
  const loop = state.investigationLoop;

  if (!loop) {
    return state;
  }

  const experimentsDone = loop.usedActionIndices.length;

  if (experimentsDone >= MAX_EXPERIMENTS) {
    const callStep = getInvestigationStepByVariant(state.steps, "call");
    const callIndex = callStep ? state.steps.indexOf(callStep) : state.currentStepIndex + 1;
    return { ...state, currentStepIndex: callIndex, phase: "playing", stepStartedAt: Date.now() };
  }

  const actionStep = state.steps[state.currentStepIndex];
  const cleared = clearStepAnswer(state, actionStep?.id);

  return {
    ...state,
    ...cleared,
    phase: "playing",
    stepStartedAt: Date.now(),
  };
}
