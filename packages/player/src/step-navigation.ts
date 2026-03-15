import { type SerializedStep } from "./prepare-activity-data";

export function isStaticNavigationStep(step: SerializedStep | undefined): boolean {
  return step?.kind === "static" || step?.kind === "visual" || step?.kind === "vocabulary";
}

export function canNavigatePrev(steps: SerializedStep[], currentStepIndex: number): boolean {
  return (
    isStaticNavigationStep(steps[currentStepIndex]) &&
    isStaticNavigationStep(steps[currentStepIndex - 1])
  );
}
