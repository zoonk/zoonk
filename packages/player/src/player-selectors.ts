import { type CompletionResult } from "@zoonk/core/player/contracts/completion-input-schema";
import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { type PlayerState } from "./player-reducer";
import { describePlayerStep, getPlayerStepImage } from "./player-step";

/** Converts a 0-based step index to a 1-based percentage (0–100). */
function computeProgress(currentIndex: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return Math.round(((currentIndex + 1) / total) * 100);
}

/** Returns the completion payload once the activity is finished, or null while still playing. */
export function getCompletionResult(state: PlayerState): CompletionResult | null {
  return state.completion;
}

/** Returns the checked result for the current step, or undefined if not yet checked. */
export function getCurrentResult(state: PlayerState) {
  const currentStep = getCurrentStep(state);

  if (!currentStep) {
    return;
  }

  return state.results[currentStep.id];
}

/** Returns the step at the current index. */
export function getCurrentStep(state: PlayerState) {
  return state.steps[state.currentStepIndex];
}

/** Returns the progress percentage (0–100), snapping to 100 when completed. */
export function getProgressValue(state: PlayerState): number {
  if (state.phase === "completed") {
    return 100;
  }

  return computeProgress(state.currentStepIndex, state.steps.length);
}

/** Returns the selected answer for the current step, or undefined if none selected. */
export function getSelectedAnswer(state: PlayerState) {
  const currentStep = getCurrentStep(state);

  if (!currentStep) {
    return;
  }

  return state.selectedAnswers[currentStep.id];
}

export type PreloadableImage = {
  kind: "selectImage" | "step";
  url: string;
};

const DEFAULT_LOOKAHEAD = 3;

/**
 * Converts one optional step image into the common preload format.
 */
function getOptionalStepImage(url?: string): PreloadableImage[] {
  return url ? [{ kind: "step", url }] : [];
}

/**
 * Select-image steps store their visuals on each option rather than a single
 * shared field, so they need a separate preload shape.
 */
function getSelectImageOptionImages(step: SerializedStep): PreloadableImage[] {
  const descriptor = describePlayerStep(step);

  if (descriptor?.kind !== "selectImage") {
    return [];
  }

  return descriptor.content.options.flatMap((option) =>
    option.url ? [{ kind: "selectImage" as const, url: option.url }] : [],
  );
}

/**
 * Removes duplicate URLs so the preloader receives one request per image even
 * when the same asset is reachable through the current feedback transition and
 * the lookahead window.
 */
function dedupeImagesByUrl(images: PreloadableImage[]): PreloadableImage[] {
  return [...new Map(images.map((image) => [image.url, image])).values()];
}

/**
 * Extracts image URLs from a step so they can be preloaded before the user
 * navigates to it. Readable steps can carry one embedded illustration,
 * image-led practice questions can own one artifact image, and selectImage
 * steps can carry one URL per option.
 */
function getStepImages(step: SerializedStep): PreloadableImage[] {
  const descriptor = describePlayerStep(step);

  if (descriptor?.kind === "selectImage") {
    return getSelectImageOptionImages(step);
  }

  return getOptionalStepImage(getPlayerStepImage(descriptor)?.url);
}

/**
 * Collects image URLs that can be needed next so they can be preloaded in the
 * background.
 */
export function getUpcomingImages(
  state: PlayerState,
  lookahead = DEFAULT_LOOKAHEAD,
): PreloadableImage[] {
  const start = state.currentStepIndex + 1;
  const upcoming = state.steps.slice(start, start + lookahead);
  const upcomingImages = upcoming.flatMap((step) => getStepImages(step));

  return dedupeImagesByUrl(upcomingImages);
}
