import { type CompletionResult } from "@zoonk/core/player/contracts/completion-input-schema";
import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { INVESTIGATION_EXPERIMENT_COUNT, STORY_OUTCOME_TIERS } from "@zoonk/utils/activities";
import { type PlayerState } from "./player-reducer";
import { describePlayerStep, getInvestigationVariant } from "./player-step";
import { EFFECT_DELTA_MAP, METRIC_AVERAGE_THRESHOLD } from "./story";

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

type InvestigationProgress = {
  collected: number;
  total: number;
};

/**
 * Returns the evidence collection progress for any investigation step,
 * or null when the current step is not part of an investigation.
 *
 * The step fraction is misleading for investigations because the
 * action step loops at the same index. This pill replaces the
 * fraction throughout the entire investigation — showing "0 / 2"
 * on the problem step, incrementing during the action loop, and
 * displaying "2 / 2" on the call step.
 */
export function getInvestigationProgress(state: PlayerState): InvestigationProgress | null {
  const step = getCurrentStep(state);
  const variant = getInvestigationVariant(step);

  if (!variant) {
    return null;
  }

  const collected = state.investigationLoop?.usedActionIds.length ?? 0;
  return { collected, total: INVESTIGATION_EXPERIMENT_COUNT };
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

export type StoryMetric = {
  metric: string;
  value: number;
};

/**
 * Story metrics describe the global scoreboard, so they live on the outcome
 * step instead of the intro's visible setup content. The player still has all
 * steps locally, which lets gameplay screens compute current metric values
 * before the learner reaches the final outcome.
 */
function findStoryMetricDefinitions(steps: SerializedStep[]) {
  for (const step of steps) {
    const descriptor = describePlayerStep(step);

    if (descriptor?.kind === "storyOutcome") {
      return descriptor.content.metrics;
    }
  }

  return [];
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
  const descriptor = describePlayerStep(step);
  const result = results[step.id];
  const answer = result?.answer;

  if (
    descriptor?.kind !== "storyDecision" ||
    !answer ||
    answer.kind !== "story" ||
    !answer.selectedChoiceId
  ) {
    return null;
  }

  return descriptor.content.choices.find((option) => option.id === answer.selectedChoiceId) ?? null;
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
 * Reads metric names from the story outcome step, then for each
 * answered story step, looks up the selected choice's metricEffects and
 * accumulates deltas (positive = +15, neutral = 0, negative = -15) starting
 * from 50.
 */
export function getStoryMetrics(state: PlayerState): StoryMetric[] {
  const metrics = findStoryMetricDefinitions(state.steps);

  if (metrics.length === 0) {
    return [];
  }

  const steps = state.steps.filter((step) => step.kind === "story");

  return metrics.map((metric) => ({
    metric: metric.label,
    value: steps.reduce(
      (sum, step) =>
        sum + getStepMetricDelta({ metric: metric.label, results: state.results, step }),
      METRIC_AVERAGE_THRESHOLD,
    ),
  }));
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
 * Story outcome screens reuse branch-specific ending illustrations, so those
 * assets are worth warming up together with the hero image.
 */
function getStoryOutcomeImages(step: SerializedStep): PreloadableImage[] {
  const descriptor = describePlayerStep(step);

  if (descriptor?.kind !== "storyOutcome") {
    return [];
  }

  return STORY_OUTCOME_TIERS.flatMap((tier) =>
    getOptionalStepImage(descriptor.content.outcomes[tier].image?.url),
  );
}

/**
 * Story decision steps preload the main scene plus the consequence image for
 * every option so feedback transitions stay instant.
 */
function getStoryDecisionImages(step: SerializedStep): PreloadableImage[] {
  const descriptor = describePlayerStep(step);

  if (descriptor?.kind !== "storyDecision") {
    return [];
  }

  return [
    ...getOptionalStepImage(descriptor.content.image?.url),
    ...descriptor.content.choices.flatMap((choice) => getOptionalStepImage(choice.stateImage?.url)),
  ];
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
 * Story consequence screens are reached from the current decision before the
 * step index advances. They must be part of the preload set even though they
 * do not belong to an upcoming step.
 */
function getCurrentStoryFeedbackImages(state: PlayerState): PreloadableImage[] {
  const descriptor = describePlayerStep(getCurrentStep(state));

  if (state.phase !== "playing" || descriptor?.kind !== "storyDecision") {
    return [];
  }

  return descriptor.content.choices.flatMap((choice) =>
    choice.stateImage?.url ? [{ kind: "step" as const, url: choice.stateImage.url }] : [],
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

  if (
    descriptor?.kind === "staticText" ||
    descriptor?.kind === "staticGrammarExample" ||
    descriptor?.kind === "staticGrammarRule" ||
    descriptor?.kind === "multipleChoice"
  ) {
    return getOptionalStepImage(descriptor.content.image?.url);
  }

  if (descriptor?.kind === "intro") {
    return getOptionalStepImage(descriptor.intro.image?.url);
  }

  if (descriptor?.kind === "storyOutcome") {
    return getStoryOutcomeImages(step);
  }

  if (descriptor?.kind === "storyDecision") {
    return getStoryDecisionImages(step);
  }

  if (descriptor?.kind === "selectImage") {
    return getSelectImageOptionImages(step);
  }

  return [];
}

/**
 * Collects image URLs that can be needed next so they can be preloaded in the
 * background. This includes upcoming steps and immediate feedback transitions
 * that can happen from the current screen without advancing the step index.
 */
export function getUpcomingImages(
  state: PlayerState,
  lookahead = DEFAULT_LOOKAHEAD,
): PreloadableImage[] {
  const start = state.currentStepIndex + 1;
  const upcoming = state.steps.slice(start, start + lookahead);
  const upcomingImages = upcoming.flatMap((step) => getStepImages(step));

  return dedupeImagesByUrl([...getCurrentStoryFeedbackImages(state), ...upcomingImages]);
}
