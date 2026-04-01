import { parseStepContent } from "@zoonk/core/steps/content-contract";
import { type SerializedStep } from "./prepare-activity-data";

/**
 * Checks whether the step's content has a story-specific static variant.
 *
 * Story static steps (intro, outcome, debrief) need action buttons instead
 * of arrow navigation, so they must be excluded from `isStaticNavigationStep`.
 */
function isStoryStaticVariant(step: SerializedStep): boolean {
  if (step.kind !== "static") {
    return false;
  }

  const content = parseStepContent("static", step.content);

  return content.variant === "storyIntro" || content.variant === "storyOutcome";
}

export function isStaticNavigationStep(step: SerializedStep | undefined): boolean {
  if (!step) {
    return false;
  }

  if (isStoryStaticVariant(step)) {
    return false;
  }

  return step.kind === "static" || step.kind === "visual" || step.kind === "vocabulary";
}

export function canNavigatePrev(steps: SerializedStep[], currentStepIndex: number): boolean {
  return (
    isStaticNavigationStep(steps[currentStepIndex]) &&
    isStaticNavigationStep(steps[currentStepIndex - 1])
  );
}
