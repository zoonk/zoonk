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

  // Each question counts once, where the learner meets it: an earlier one opened again from a
  // later screen keeps its place, and the screen it was opened from is still ahead.
  const ahead = view.steps.filter((step) => isSetupQuestion(step));

  const behind = history.filter(
    (step) => isSetupQuestion(step) && (step === current || !ahead.includes(step)),
  );

  const order = [...new Set([...behind, current, ...ahead])];
  return { current: order.indexOf(current), total: order.length };
}
