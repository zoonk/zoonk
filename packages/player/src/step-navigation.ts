import { isInvestigationScoreVariant } from "./investigation";
import { type SerializedStep } from "./prepare-activity-data";
import { isStoryStaticVariant } from "./story";

export function isStaticNavigationStep(step: SerializedStep | undefined): boolean {
  if (!step) {
    return false;
  }

  if (isStoryStaticVariant(step)) {
    return false;
  }

  if (isInvestigationScoreVariant(step)) {
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
