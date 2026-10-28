import {
  type OnboardingStep,
  type OnboardingView,
} from "@zoonk/core/view-models/onboarding/contract";

export type FlowState = {
  current: OnboardingStep;
  history: OnboardingStep[];
  view: OnboardingView;
};

/** A response for a screen no longer shown (the learner went Back while it saved) keeps the learner where they are. */
export function applyAnswer({
  state,
  step,
  view,
}: {
  state: FlowState;
  step: OnboardingStep;
  view: OnboardingView;
}): FlowState {
  if (state.current !== step) {
    return { ...state, view };
  }

  return {
    current: view.steps.find((next) => next !== step) ?? "plan",
    history: [...state.history, step],
    view,
  };
}
