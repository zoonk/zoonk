import { type StoryStaticVariant, parseStepContent } from "@zoonk/core/steps/content-contract";
import { type CompletionResult } from "./completion-input-schema";
import { type PlayerState } from "./player-reducer";
import { type SerializedStep } from "./prepare-activity-data";
import { canNavigatePrev, isStaticNavigationStep } from "./step-navigation";
import { EFFECT_DELTA_MAP } from "./story";

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

/** Returns true when the activity contains at least one story decision step. */
export function getIsStoryActivity(state: PlayerState): boolean {
  return state.steps.some((step) => step.kind === "story");
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
  const step = getCurrentStep(state);

  if (!step || step.kind !== "static") {
    return null;
  }

  const content = parseStepContent("static", step.content);

  if (content.variant === "storyIntro" || content.variant === "storyOutcome") {
    return content.variant;
  }

  return null;
}

export type StoryMetric = {
  metric: string;
  value: number;
};

const METRIC_STARTING_VALUE = 50;

/**
 * Finds the storyIntro step and returns its parsed content, or null if
 * no intro step exists. Shared by getStoryMetrics (needs metrics) and
 * getStoryBriefingText (needs intro text).
 */
function findStoryIntroContent(steps: SerializedStep[]) {
  const introStep = steps.find((step) => step.kind === "static");

  if (!introStep) {
    return null;
  }

  const content = parseStepContent("static", introStep.content);

  if (content.variant !== "storyIntro") {
    return null;
  }

  return content;
}

/**
 * Extracts the selected choice from a story step result, if available.
 * Returns null when the step has no result or the choice ID doesn't match.
 */
function findSelectedChoice({
  step,
  results,
}: {
  step: SerializedStep;
  results: Record<string, { answer?: { kind: string; selectedChoiceId?: string } }>;
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
  results: Record<string, { answer?: { kind: string; selectedChoiceId?: string } }>;
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
      METRIC_STARTING_VALUE,
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
