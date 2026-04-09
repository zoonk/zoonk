import { describePlayerStep } from "./player-step";
import { usesStaticNavigation } from "./player-step-behavior";
import { type SerializedStep } from "./prepare-activity-data";

/**
 * Navigation chrome, layout, and keyboard shortcuts all need the same answer
 * to "does this step behave like a navigable static screen?" Routing that
 * question through the canonical step descriptor keeps those behaviors aligned.
 */
export function isStaticNavigationStep(step: SerializedStep | undefined): boolean {
  return usesStaticNavigation(describePlayerStep(step));
}

/**
 * Previous-step navigation is only available when both the current step and
 * the previous step participate in static navigation. This prevents arrow-key
 * backtracking into interactive steps with incompatible affordances.
 */
export function canNavigatePrev(steps: SerializedStep[], currentStepIndex: number): boolean {
  return (
    isStaticNavigationStep(steps[currentStepIndex]) &&
    isStaticNavigationStep(steps[currentStepIndex - 1])
  );
}
