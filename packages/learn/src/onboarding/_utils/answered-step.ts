import {
  type OnboardingStep,
  type OnboardingView,
} from "@zoonk/core/view-models/onboarding/contract";

/** Where the steps' flow is: the screen shown, the ones answered before it, and the goal's view. */
export type FlowState = {
  current: OnboardingStep;
  history: OnboardingStep[];
  view: OnboardingView;
};

/**
 * The flow once the answer to `step` saved: it moves on from that screen to the next one the goal
 * still needs. A response for a screen no longer shown (the learner went Back while it saved)
 * keeps the learner where they are, with the saved view, so no answer moves the flow twice or
 * past a question nobody answered.
 */
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
