import { type CompletionResult } from "./completion-input-schema";
import { hasNegativeDimension } from "./dimensions";
import { type PlayerState } from "./player-reducer";
import { canNavigatePrev, isStaticNavigationStep } from "./step-navigation";

function computeProgress(currentIndex: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return Math.round(((currentIndex + 1) / total) * 100);
}

export function getCanNavigatePrev(state: PlayerState): boolean {
  return canNavigatePrev(state.steps, state.currentStepIndex);
}

export function getChangedDimensions(state: PlayerState): Set<string> {
  return new Set(
    Object.entries(state.dimensions)
      .filter(([name, value]) => value !== state.previousDimensions[name])
      .map(([name]) => name),
  );
}

export function getCompletionResult(state: PlayerState): CompletionResult | null {
  if (state.completion.status === "idle" || state.completion.status === "submitting") {
    return null;
  }

  return state.completion;
}

export function getCurrentResult(state: PlayerState) {
  const currentStep = getCurrentStep(state);

  if (!currentStep) {
    return;
  }

  return state.results[currentStep.id];
}

export function getCurrentStep(state: PlayerState) {
  return state.steps[state.currentStepIndex];
}

export function getHasAnswer(state: PlayerState): boolean {
  const currentStep = getCurrentStep(state);

  if (!currentStep) {
    return false;
  }

  return Boolean(state.selectedAnswers[currentStep.id]);
}

export function getIsGameOver(state: PlayerState): boolean {
  if (state.phase !== "completed" || Object.keys(state.dimensions).length === 0) {
    return false;
  }

  return hasNegativeDimension(state.dimensions);
}

export function getIsStaticStep(state: PlayerState): boolean {
  return isStaticNavigationStep(getCurrentStep(state));
}

export function getProgressValue(state: PlayerState): number {
  if (state.phase === "completed") {
    return 100;
  }

  return computeProgress(state.currentStepIndex, state.steps.length);
}

export function getSelectedAnswer(state: PlayerState) {
  const currentStep = getCurrentStep(state);

  if (!currentStep) {
    return;
  }

  return state.selectedAnswers[currentStep.id];
}
