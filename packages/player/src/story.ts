import { type StoryStaticVariant, parseStepContent } from "@zoonk/core/steps/content-contract";
import { type SerializedStep } from "./prepare-activity-data";

/**
 * Returns the story-specific static variant ("storyIntro" or "storyOutcome")
 * of a step, or null if the step is not a story static screen.
 *
 * Shared by `isStoryStaticVariant` (boolean gate for reducer/navigation)
 * and `getStoryStaticVariant` (selector that lifts this to PlayerState level).
 */
export function getStepStoryVariant(step: SerializedStep | undefined): StoryStaticVariant | null {
  if (!step || step.kind !== "static") {
    return null;
  }

  const content = parseStepContent("static", step.content);

  if (content.variant === "storyIntro" || content.variant === "storyOutcome") {
    return content.variant;
  }

  return null;
}

/**
 * Checks whether a step is a story-specific static variant (storyIntro
 * or storyOutcome). These steps use action buttons for forward-only
 * navigation instead of arrow keys, and need special handling in the
 * reducer and navigation guards.
 */
export function isStoryStaticVariant(step: SerializedStep): boolean {
  return getStepStoryVariant(step) !== null;
}

/**
 * Shared threshold values for story metric feedback.
 *
 * Used by both visual (pill color) and tactile (haptics) feedback
 * to ensure consistent severity bands across the player.
 */
export const METRIC_CRITICAL_THRESHOLD = 15;
export const METRIC_DANGER_THRESHOLD = 25;
export const METRIC_AVERAGE_THRESHOLD = 50;
export const METRIC_GOOD_THRESHOLD = 60;

/**
 * Fixed delta applied to a metric when a story choice has a positive,
 * neutral, or negative effect. Used by both the metrics bar (cumulative
 * totals) and the feedback screen (per-choice badges).
 */
export const EFFECT_DELTA_MAP = {
  negative: -15,
  neutral: 0,
  positive: 15,
} as const;
