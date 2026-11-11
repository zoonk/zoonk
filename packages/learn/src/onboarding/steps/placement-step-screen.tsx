"use client";

import { type OnboardingView } from "@zoonk/core/view-models/onboarding/contract";
import { FocusTestFlow } from "../../focus-test/focus-test-flow";
import { type GenerationRun } from "../../generation/generation-run";
import { LanguageLevelTestStep } from "../../language/level-test/level-test-step";
import { type OnboardingActions } from "../onboarding-actions";
import { PlacementStep } from "./placement-step";

function getNativeLanguage(view: OnboardingView): string {
  const native = view.goal.details.nativeLanguage;
  return typeof native === "string" && native.trim() ? native : view.goal.language;
}

/** Each kind of goal finds where the learner starts its own way; an exam's is its Focus test. */
export function PlacementStepScreen({
  actions,
  onDone,
  onFinishFailed,
  run,
  subject,
  view,
}: {
  actions: OnboardingActions;
  /** Saves the step and resolves whether it went through. */
  onDone: () => Promise<boolean>;
  onFinishFailed: (failed: boolean) => void;
  run: GenerationRun | null;
  subject: string;
  view: OnboardingView;
}) {
  const { goal } = view;

  if (goal.kind === "language" && goal.targetLanguage) {
    return (
      <LanguageLevelTestStep
        actions={actions.languageLevelTest(goal.id)}
        goal={{ language: getNativeLanguage(view), targetLanguage: goal.targetLanguage }}
        goalId={goal.id}
        onDone={onDone}
        onFinishFailed={onFinishFailed}
      />
    );
  }

  if (goal.kind === "exam") {
    return (
      <FocusTestFlow
        actions={actions.focusTest(goal.id)}
        host="onboarding"
        onDone={onDone}
        readWarmUp={actions.readWarmUp}
        run={run}
        subject={subject}
      />
    );
  }

  return (
    <PlacementStep
      actions={actions}
      goalId={goal.id}
      onDone={onDone}
      onFinishFailed={onFinishFailed}
      run={run}
      subject={subject}
    />
  );
}
