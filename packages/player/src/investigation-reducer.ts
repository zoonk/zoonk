import { parseStepContent } from "@zoonk/core/steps/contract/content";
import { type InvestigationLoopState, getInvestigationStepByVariant } from "./investigation";
import { type PlayerState, type SelectedAnswer } from "./player-reducer";
import { type SerializedStep } from "./prepare-activity-data";

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
 * Initializes the investigation loop state when the problem step is checked.
 * Records the learner's chosen hunch index so subsequent steps can look up
 * interpretation sets and mark the hunch on the call screen.
 */
function initInvestigationLoop(
  _state: PlayerState,
  answer: SelectedAnswer,
): InvestigationLoopState {
  const hunchIndex =
    answer.kind === "investigation" && answer.variant === "problem"
      ? answer.selectedExplanationIndex
      : 0;

  return {
    experimentResults: [],
    hunchIndex,
    usedActionIndices: [],
  };
}

/**
 * Records a used action index in the investigation loop when the action
 * step is checked. The action index is stored for scoring (quality tiers)
 * and for filtering out used actions on subsequent visits.
 */
export function recordActionInLoop(
  loop: InvestigationLoopState,
  answer: SelectedAnswer,
): InvestigationLoopState {
  if (answer.kind !== "investigation" || answer.variant !== "action") {
    return loop;
  }

  if (answer.readyForCall) {
    return loop;
  }

  return {
    ...loop,
    usedActionIndices: [...loop.usedActionIndices, answer.selectedActionIndex],
  };
}

/**
 * Records an experiment result (action index + interpretation correctness)
 * in the investigation loop when the evidence step is checked.
 */
function recordExperimentInLoop(
  loop: InvestigationLoopState,
  isCorrect: boolean,
): InvestigationLoopState {
  const lastActionIndex = loop.usedActionIndices.at(-1);

  if (lastActionIndex === undefined) {
    return loop;
  }

  return {
    ...loop,
    experimentResults: [...loop.experimentResults, { actionIndex: lastActionIndex, isCorrect }],
  };
}

/** Advances from the investigation problem step to the action step. */
export function continueFromProblem(state: PlayerState): PlayerState {
  const currentStep = state.steps[state.currentStepIndex];
  const answer = currentStep ? state.selectedAnswers[currentStep.id] : undefined;
  const loop = initInvestigationLoop(
    state,
    answer ?? { kind: "investigation", selectedExplanationIndex: 0, variant: "problem" },
  );
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

/** Advances from the action step to evidence or call (if readyForCall). */
export function continueFromAction(state: PlayerState): PlayerState {
  const currentStep = state.steps[state.currentStepIndex];
  const answer = currentStep ? state.selectedAnswers[currentStep.id] : undefined;
  const readyForCall =
    answer?.kind === "investigation" && answer.variant === "action" && answer.readyForCall;

  if (readyForCall) {
    const callStep = getInvestigationStepByVariant(state.steps, "call");
    const callIndex = callStep ? state.steps.indexOf(callStep) : state.currentStepIndex + 2;
    return { ...state, currentStepIndex: callIndex, phase: "playing", stepStartedAt: Date.now() };
  }

  const evidenceStep = getInvestigationStepByVariant(state.steps, "evidence");
  const evidenceIndex = evidenceStep
    ? state.steps.indexOf(evidenceStep)
    : state.currentStepIndex + 1;
  return { ...state, currentStepIndex: evidenceIndex, phase: "playing", stepStartedAt: Date.now() };
}

/**
 * Removes the selected answer and result for a given step ID.
 *
 * Used when the investigation loop revisits a physical step (action
 * or evidence) — the previous experiment's answer must be cleared
 * so the component renders a fresh slate instead of showing a stale
 * selection from the last iteration.
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

/** Loops from evidence back to the action step after recording the experiment result. */
export function continueFromEvidence(state: PlayerState): PlayerState {
  const currentStep = state.steps[state.currentStepIndex];
  const loop = state.investigationLoop;
  const result = currentStep ? state.results[currentStep.id] : undefined;
  const isCorrect = result?.result.isCorrect ?? false;
  const updatedLoop = loop ? recordExperimentInLoop(loop, isCorrect) : loop;
  const actionStep = getInvestigationStepByVariant(state.steps, "action");
  const actionIndex = actionStep ? state.steps.indexOf(actionStep) : state.currentStepIndex - 1;

  /**
   * Clear both the evidence step's and the action step's answers
   * so the next iteration starts fresh. Without this, the evidence
   * component would show the previous experiment's selected tier
   * and the action step would show the previous action as selected.
   */
  const clearedEvidence = clearStepAnswer(state, currentStep?.id);
  const clearedBoth = clearStepAnswer({ ...state, ...clearedEvidence }, actionStep?.id);

  return {
    ...state,
    ...clearedBoth,
    currentStepIndex: actionIndex,
    investigationLoop: updatedLoop,
    phase: "playing",
    stepStartedAt: Date.now(),
  };
}
