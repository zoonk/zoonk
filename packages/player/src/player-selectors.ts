import { type StoryStaticVariant, parseStepContent } from "@zoonk/core/steps/contract/content";
import { type CompletionResult } from "./completion-input-schema";
import { getInvestigationHunchText, isInvestigationScoreVariant } from "./investigation";
import { type PlayerState } from "./player-reducer";
import { type SerializedStep } from "./prepare-activity-data";
import { canNavigatePrev, isStaticNavigationStep } from "./step-navigation";
import { EFFECT_DELTA_MAP, METRIC_AVERAGE_THRESHOLD, getStepStoryVariant } from "./story";

/** Converts a 0-based step index to a 1-based percentage (0–100). */
function computeProgress(currentIndex: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return Math.round(((currentIndex + 1) / total) * 100);
}

/** Whether the player can navigate to the previous step. */
export function getCanNavigatePrev(state: PlayerState): boolean {
  return canNavigatePrev(state.steps, state.currentStepIndex);
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

/** Whether the player has selected an answer for the current step. */
export function getHasAnswer(state: PlayerState): boolean {
  const currentStep = getCurrentStep(state);

  if (!currentStep) {
    return false;
  }

  return Boolean(state.selectedAnswers[currentStep.id]);
}

/** Whether the current step uses static (auto-advance) navigation. */
export function getIsStaticStep(state: PlayerState): boolean {
  return isStaticNavigationStep(getCurrentStep(state));
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

/** Returns true when the activity contains at least one story decision step. */
export function getIsStoryActivity(state: PlayerState): boolean {
  return state.steps.some((step) => step.kind === "story");
}

/**
 * Returns the hunch text for the sticky header popover, or null
 * if the current step is not an investigation step past the problem.
 */
export function getInvestigationHunch(state: PlayerState): string | null {
  return getInvestigationHunchText(state);
}

/**
 * Returns true if the current step is the investigation score screen.
 * Used by the shell to show a "Continue" button instead of arrow navigation.
 */
export function getIsInvestigationScoreStep(state: PlayerState): boolean {
  const currentStep = state.steps[state.currentStepIndex];
  return isInvestigationScoreVariant(currentStep);
}

/**
 * Returns the intro text from the storyIntro step, or null if the current
 * step is not a story decision step.
 *
 * Used by the sticky header to show a briefing popover only during
 * decision-making, so players can recall the premise without navigating back.
 */
export function getStoryBriefingText(state: PlayerState): string | null {
  const currentStep = getCurrentStep(state);

  if (!currentStep || currentStep.kind !== "story") {
    return null;
  }

  const introContent = findStoryIntroContent(state.steps);

  if (!introContent) {
    return null;
  }

  return introContent.intro;
}

/**
 * Returns the story-specific static variant of the current step, or null
 * if the current step is not a story static screen.
 *
 * Used by PlayerShell to pick the correct bottom bar (Begin, Continue)
 * and by keyboard handlers for Enter key behavior.
 */
export function getStoryStaticVariant(state: PlayerState): StoryStaticVariant | null {
  return getStepStoryVariant(getCurrentStep(state));
}

export type StoryMetric = {
  metric: string;
  value: number;
};

/**
 * Finds the storyIntro step and returns its parsed content, or null if
 * no intro step exists. Shared by getStoryMetrics (needs metrics) and
 * getStoryBriefingText (needs intro text).
 *
 * Scans all static steps (not just the first one) because a non-intro
 * static step could appear earlier in the list.
 */
function findStoryIntroContent(steps: SerializedStep[]) {
  for (const step of steps) {
    if (step.kind === "static") {
      const content = parseStepContent("static", step.content);

      if (content.variant === "storyIntro") {
        return content;
      }
    }
  }

  return null;
}

/**
 * Extracts the selected choice from a story step result, if available.
 * Returns null when the step has no result or the choice ID doesn't match.
 *
 * Also used by the outcome screen to determine choice alignment
 * without duplicating the lookup logic.
 */
export function findSelectedChoice({
  step,
  results,
}: {
  step: SerializedStep;
  results: PlayerState["results"];
}) {
  const result = results[step.id];
  const answer = result?.answer;

  if (!answer || answer.kind !== "story" || !answer.selectedChoiceId) {
    return null;
  }

  const choiceId = answer.selectedChoiceId;
  const content = parseStepContent("story", step.content);

  return content.choices.find((option) => option.id === choiceId) ?? null;
}

/**
 * Returns the delta a single step contributes to a specific metric.
 * Returns 0 when the step has no result or the choice doesn't affect
 * the given metric.
 */
function getStepMetricDelta({
  metric,
  results,
  step,
}: {
  metric: string;
  results: PlayerState["results"];
  step: SerializedStep;
}): number {
  const choice = findSelectedChoice({ results, step });

  if (!choice) {
    return 0;
  }

  const effect = choice.metricEffects.find((entry) => entry.metric === metric);
  return effect ? EFFECT_DELTA_MAP[effect.effect] : 0;
}

/**
 * Computes the current value of each story metric by summing deltas
 * from all completed story steps.
 *
 * Reads metric names from the storyIntro step (first step), then for each
 * answered story step, looks up the selected choice's metricEffects and
 * accumulates deltas (positive = +15, neutral = 0, negative = -15) starting
 * from 50.
 */
export function getStoryMetrics(state: PlayerState): StoryMetric[] {
  const introContent = findStoryIntroContent(state.steps);

  if (!introContent) {
    return [];
  }

  const storySteps = state.steps.filter((step) => step.kind === "story");

  return introContent.metrics.map((name) => ({
    metric: name,
    value: storySteps.reduce(
      (sum, step) => sum + getStepMetricDelta({ metric: name, results: state.results, step }),
      METRIC_AVERAGE_THRESHOLD,
    ),
  }));
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
