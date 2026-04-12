import { type CompletionResult } from "@zoonk/core/player/contracts/completion-input-schema";
import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { INVESTIGATION_EXPERIMENT_COUNT } from "@zoonk/utils/activities";
import { getInvestigationScenario } from "./investigation";
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

/**
 * Returns the scenario data for the sticky header recall popover,
 * or null if the current step is not an investigation step past the problem.
 */
export function getInvestigationScenarioData(state: PlayerState) {
  return getInvestigationScenario(state);
}

/**
 * Returns the intro text from the storyIntro step, or null if the current
 * step is not a story decision step.
 *
 * Used by the sticky header to show a briefing popover only during
 * decision-making, so players can recall the premise without navigating back.
 */
export function getStoryBriefingText(state: PlayerState): string | null {
  const currentDescriptor = describePlayerStep(getCurrentStep(state));

  if (currentDescriptor?.kind !== "storyDecision") {
    return null;
  }

  const introContent = findStoryIntroContent(state.steps);

  if (!introContent) {
    return null;
  }

  return introContent.intro;
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
    const descriptor = describePlayerStep(step);

    if (descriptor?.kind === "storyIntro") {
      return descriptor.content;
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
  const descriptor = describePlayerStep(step);

  if (descriptor?.kind === "visual") {
    if (descriptor.content.kind !== "image" || !descriptor.content.url) {
      return [];
    }

    return [{ kind: "visual", url: descriptor.content.url }];
  }

  if (descriptor?.kind === "selectImage") {
    return descriptor.content.options.flatMap((option) =>
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
