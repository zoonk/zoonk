import {
  type OnboardingStep,
  type OnboardingView,
} from "@zoonk/core/view-models/onboarding/contract";

export type FlowState = {
  current: OnboardingStep;
  history: OnboardingStep[];
  view: OnboardingView;
};

export function openStep({ state, step }: { state: FlowState; step: OnboardingStep }): FlowState {
  return { ...state, current: step, history: [...state.history, state.current] };
}

/**
 * A response for a screen no longer shown (the learner went Back while it saved) keeps the learner
 * where they are. Reaching a screen already in the history returns to it as it was, so Back skips
 * the questions opened from it.
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

  const current = view.steps.find((next) => next !== step) ?? "plan";
  const history = [...state.history, step];
  const seen = history.indexOf(current);

  return { current, history: seen === -1 ? history : history.slice(0, seen), view };
}
