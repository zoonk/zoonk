import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { describePlayerStep } from "./player-step";
import { hasStaticNavigation } from "./player-step-behavior";

/**
 * Navigation chrome, layout, and keyboard shortcuts all need the same answer
 * to "does this step behave like a navigable static screen?" Routing that
 * question through the canonical step descriptor keeps those behaviors aligned.
 */
function isStaticNavigationStep(step?: SerializedStep): boolean {
  return hasStaticNavigation(describePlayerStep(step));
}

/**
 * Previous-step navigation is only available when both the current step and
 * the previous step participate in static navigation. This prevents arrow-key
 * backtracking into interactive steps with incompatible affordances.
 */
export function canNavigatePrev({
  currentStepIndex,
  steps,
}: {
  currentStepIndex: number;
  steps: SerializedStep[];
}): boolean {
  return (
    isStaticNavigationStep(steps[currentStepIndex]) &&
    isStaticNavigationStep(steps[currentStepIndex - 1])
  );
}
