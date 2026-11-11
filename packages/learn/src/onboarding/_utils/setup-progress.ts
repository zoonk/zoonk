import { isProfileQuestion } from "@zoonk/core/profile/questions/contract";
import { type OnboardingStep } from "@zoonk/core/view-models/onboarding/contract";

type ProgressInput = {
  current: OnboardingStep;
  history: readonly OnboardingStep[];
  view: { steps: readonly OnboardingStep[] };
};

function isSetupQuestion(step: OnboardingStep): boolean {
  return step !== "plan" && step !== "placement";
}

/** Every profile screen shares one dot, so the bar keeps its scale. */
function toDot(step: OnboardingStep): string {
  return isProfileQuestion(step) ? "profile" : step;
}

/**
 * Each question counts once, where the learner meets it: an earlier one opened again from a later
 * screen keeps its place, and the screen it was opened from is still ahead.
 */
function getPlace<Step extends string>({
  ahead,
  behind,
  current,
}: {
  ahead: readonly Step[];
  behind: readonly Step[];
  current: Step;
}): { current: number; total: number } {
  const passed = behind.filter((step) => step === current || !ahead.includes(step));
  const order = [...new Set([...passed, current, ...ahead])];
  return { current: order.indexOf(current), total: order.length };
}

export function getSetupProgress({
  current,
  history,
  view,
}: ProgressInput): { current: number; total: number } | null {
  if (!isSetupQuestion(current)) {
    return null;
  }

  return getPlace({
    ahead: view.steps.filter((step) => isSetupQuestion(step)).map((step) => toDot(step)),
    behind: history.filter((step) => isSetupQuestion(step)).map((step) => toDot(step)),
    current: toDot(current),
  });
}

/** Counts only this run's profile screens, so a learner with memory off sees "1 of 2". */
export function getProfileProgress({
  current,
  history,
  view,
}: ProgressInput): { current: number; total: number } | null {
  if (!isProfileQuestion(current)) {
    return null;
  }

  const place = getPlace({
    ahead: view.steps.filter((step) => isProfileQuestion(step)),
    behind: history.filter((step) => isProfileQuestion(step)),
    current,
  });

  return { current: place.current + 1, total: place.total };
}
