"use client";

import { type OnboardingView } from "@zoonk/core/view-models/onboarding/contract";
import { useState } from "react";
import { FocusTestFlow } from "../../focus-test/focus-test-flow";
import { type GenerationRun } from "../../generation/generation-run";
import { LanguagePlanTestFlow } from "../../language/level-test/level-test-flow";
import { LanguageLevelTestStep } from "../../language/level-test/level-test-step";
import { PlacementTestFlow } from "../../placement-test/placement-test-flow";
import { getNativeLanguage } from "../_utils/onboarding-view-reads";
import { type OnboardingActions } from "../onboarding-actions";
import { PlacementStep } from "./placement-step";
import { StepLoadFailed, StepLoading } from "./step-parts";
import { useReadOnOpen } from "./use-read-on-open";

/** Each kind of goal finds where the learner starts its own way; an exam's is its Focus test. */
type Props = {
  actions: OnboardingActions;
  onDone: (attemptId?: string) => Promise<boolean>;
  onFinishFailed: (failed: boolean) => void;
  run: GenerationRun | null;
  subject: string;
  view: OnboardingView;
};

function CoursePlacementStep({ actions, onDone, onFinishFailed, run, subject, view }: Props) {
  const { goal } = view;

  const [course, setCourse] = useState<{
    minutes: number;
    stage: "quick" | "assessment" | "topics";
  } | null>(null);

  const [failed, setFailed] = useState(false);
  const placement = actions.placementTest(goal.id);

  const startTopics = async () => {
    const opened = await placement.start("wholeCourse");

    if (
      ((opened.status === "notReady" || opened.status === "ready") && opened.attempt) ||
      (opened.status === "ready" && opened.result)
    ) {
      setCourse((current) => current && { ...current, stage: "topics" });
      return true;
    }

    return false;
  };

  const level = actions.languagePlanTest({ goalId: goal.id, walkTopics: startTopics });

  const reopen = useReadOnOpen({
    onRead: (data) => {
      if (!data || data.placement.status === "failed") {
        setFailed(true);
        return;
      }

      const outcome = data.placement;

      const topics =
        ((outcome.status === "ready" || outcome.status === "notReady") &&
          outcome.attempt?.length === "wholeCourse") ||
        (outcome.status === "ready" && outcome.result);

      const assessment = data.assessment?.length === "wholeCourse" ? "assessment" : "quick";
      const stage = topics ? "topics" : assessment;
      setFailed(false);
      setCourse({ minutes: data.minutes, stage });
    },
    read: async () => {
      const [minutes, outcome, assessment] = await Promise.all([
        actions.getPlacementMinutes(goal.id),
        placement.get(),
        goal.kind === "language" ? level.get() : null,
      ]);

      return { assessment, minutes, placement: outcome };
    },
  });

  if (failed) {
    return <StepLoadFailed onRetry={reopen} />;
  }

  if (!course) {
    return <StepLoading />;
  }

  if (course.stage === "topics") {
    return (
      <PlacementTestFlow
        actions={placement}
        onDone={() => onDone()}
        onOnboardingDone={onDone}
        readWarmUp={actions.readWarmUp}
        run={run}
        subject={subject}
        wholeCourseMinutes={course.minutes}
      />
    );
  }

  if (goal.kind === "language" && goal.targetLanguage) {
    if (course.stage === "assessment") {
      return (
        <LanguagePlanTestFlow
          actions={level}
          onDone={() => onDone()}
          onboarding
          readWarmUp={actions.readWarmUp}
          targetLanguage={goal.targetLanguage}
          testOutLevel={null}
          trueFalseLabels="trueFalse"
          wholeCourseMinutes={course.minutes}
        />
      );
    }

    return (
      <LanguageLevelTestStep
        actions={actions.languageLevelTest(goal.id)}
        goal={{ language: getNativeLanguage(view), targetLanguage: goal.targetLanguage }}
        goalId={goal.id}
        onDone={onDone}
        onFinishFailed={onFinishFailed}
        onWholeCourse={async () => {
          const opened = await level.start("wholeCourse");

          if (opened?.attemptId) {
            setCourse({ ...course, stage: "assessment" });
          }

          return Boolean(opened?.attemptId);
        }}
        wholeCourseMinutes={course.minutes}
      />
    );
  }

  return (
    <PlacementStep
      actions={actions}
      goalId={goal.id}
      onDone={onDone}
      onFinishFailed={onFinishFailed}
      onWholeCourse={startTopics}
      run={run}
      subject={subject}
      wholeCourseMinutes={course.minutes}
    />
  );
}

export function PlacementStepScreen({
  actions,
  onDone,
  onFinishFailed,
  run,
  subject,
  view,
}: Props) {
  const { goal } = view;

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
    <CoursePlacementStep
      actions={actions}
      onDone={onDone}
      onFinishFailed={onFinishFailed}
      run={run}
      subject={subject}
      view={view}
    />
  );
}
