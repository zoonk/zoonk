import { parseStepContent } from "@zoonk/core/steps/content-contract";
import { type CompletionResult } from "./completion-input-schema";
import { type PlayerState } from "./player-reducer";
import { type SerializedStep } from "./prepare-activity-data";
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

export function getCompletionResult(state: PlayerState): CompletionResult | null {
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

export type PreloadableImage = {
  kind: "selectImage" | "visual";
  url: string;
};

const DEFAULT_LOOKAHEAD = 3;

/**
 * Extracts image URLs from a step so they can be preloaded before the user
 * navigates to it. Visual image steps have a single URL; selectImage steps
 * have one URL per option.
 */
function getStepImages(step: SerializedStep): PreloadableImage[] {
  if (step.kind === "visual") {
    const content = parseStepContent("visual", step.content);

    if (content.kind !== "image" || !content.url) {
      return [];
    }

    return [{ kind: "visual", url: content.url }];
  }

  if (step.kind === "selectImage") {
    const content = parseStepContent("selectImage", step.content);

    return content.options.flatMap((option) =>
      option.url ? [{ kind: "selectImage" as const, url: option.url }] : [],
    );
  }

  return [];
}

/**
 * Collects image URLs from the next few steps so they can be preloaded in the
 * background. This eliminates the 1-2 second delay users experience when
 * navigating to steps that contain images.
 */
export function getUpcomingImages(
  state: PlayerState,
  lookahead = DEFAULT_LOOKAHEAD,
): PreloadableImage[] {
  const start = state.currentStepIndex + 1;
  const upcoming = state.steps.slice(start, start + lookahead);
  return upcoming.flatMap((step) => getStepImages(step));
}
