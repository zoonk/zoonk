import { type OnboardingStep } from "@zoonk/core/view-models/onboarding/contract";

function isSetupQuestion(step: OnboardingStep): boolean {
  return step !== "plan" && step !== "placement";
}

export function getSetupProgress({
  current,
  history,
  view,
}: {
  current: OnboardingStep;
  history: readonly OnboardingStep[];
  view: { steps: readonly OnboardingStep[] };
}): { current: number; total: number } | null {
  if (!isSetupQuestion(current)) {
    return null;
  }

  const answered = history.filter((step) => isSetupQuestion(step)).length;
  const remaining = view.steps.filter((step) => step !== current && isSetupQuestion(step)).length;
  return { current: answered, total: answered + 1 + remaining };
}
