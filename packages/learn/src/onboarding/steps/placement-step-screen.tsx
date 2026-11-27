"use client";

import { type OnboardingView } from "@zoonk/core/view-models/onboarding/contract";
import { FocusTestFlow } from "../../focus-test/focus-test-flow";
import { type GenerationRun } from "../../generation/generation-run";
import { LanguagePlanTestFlow } from "../../language/level-test/level-test-flow";
import { PlacementTestFlow } from "../../placement-test/placement-test-flow";
import { getNativeLanguage } from "../_utils/onboarding-view-reads";
import { type OnboardingActions } from "../onboarding-actions";

/** Each kind of goal finds where the learner starts its own way; an exam's is its Focus test. */
export function PlacementStepScreen({
  actions,
  onDone,
  run,
  subject,
  view,
}: {
  actions: OnboardingActions;
  /** Saves the step and goes on with setup; false when it didn't. */
  onDone: (attemptId?: string) => Promise<boolean>;
  run: GenerationRun | null;
  subject: string;
  view: OnboardingView;
}) {
  const { goal, placement } = view;
  // The server decides: a test the learner asked for opens at once, an offered one waits for a pick.
  const mode = placement?.mode ?? "resume";
  const test = placement?.test;
  const firstLesson = view.firstLesson?.title ?? null;

  if (goal.kind === "exam") {
    return (
      <FocusTestFlow
        actions={actions.focusTest(goal.id)}
        asked={mode === "direct"}
        goalId={goal.id}
        host="onboarding"
        firstLesson={firstLesson}
        onDone={onDone}
        readWarmUp={actions.readWarmUp}
        run={run}
        subject={subject}
      />
    );
  }

  if (goal.kind === "language" && goal.targetLanguage) {
    return (
      <LanguagePlanTestFlow
        actions={actions.languagePlanTest(goal.id)}
        goal={goal}
        goalId={goal.id}
        host={{ firstLesson, mode, surface: "onboarding" }}
        onLeave={() => onDone()}
        ownLanguage={{
          language: getNativeLanguage(view),
          onSwitch: (language) => actions.switchAppLanguage({ goalId: goal.id, language }),
        }}
        readWarmUp={actions.readWarmUp}
        targetLanguage={goal.targetLanguage}
        testOutLevel={null}
        trueFalseLabels="trueFalse"
      />
    );
  }

  return (
    <PlacementTestFlow
      actions={actions.placementTest(goal.id)}
      goalId={goal.id}
      host={{
        decline: () => actions.finishPlacement({ fromScratch: true, goalId: goal.id }),
        firstLesson,
        mode,
        surface: "onboarding",
      }}
      offer={test?.kind === "course" ? test.offer : null}
      onLeave={onDone}
      readWarmUp={actions.readWarmUp}
      run={run}
      subject={subject}
    />
  );
}
