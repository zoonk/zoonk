"use client";

import { useExtracted } from "next-intl";
import { type GenerationRun } from "../generation/generation-run";
import { type OnboardingActions, type PlacementAnswer } from "../onboarding/onboarding-actions";
import { PlacementQuestionScreen } from "../onboarding/steps/placement-question";
import { PlacementUnavailable } from "../onboarding/steps/placement-screens";
import { PlacementWaiting, useWaitLeave } from "../onboarding/steps/placement-waiting";
import { StepLoadFailed, StepLoading } from "../onboarding/steps/step-parts";
import { useFirstQuestionShown, useTestAnalytics } from "../placement-test/use-test-analytics";
import { useTestFacts } from "../placement-test/use-test-facts";
import { type FocusTestActions } from "./focus-test-actions";
import { type QuestionPhase } from "./focus-test-phase";
import { type FocusTestPlanActions } from "./focus-test-proposal";
import { FocusTestCheckpoint, type FocusTestHost } from "./focus-test-result";
import { FocusTestEnded, FocusTestInvitation } from "./focus-test-screens";
import { useFocusTest } from "./use-focus-test";
import { useSeeResultLabel } from "./use-focus-test-texts";

function FocusTestQuestion({
  onAnswer,
  onClose,
  onStop,
  pending,
  phase,
  subject,
}: {
  onAnswer: (answer: PlacementAnswer, durationMs: number) => void;
  onClose: () => void;
  onStop: () => void;
  pending: boolean;
  phase: QuestionPhase;
  subject: string;
}) {
  const t = useExtracted();
  const facts = useTestFacts();
  const { sitting } = phase;
  const number = sitting.answered + 1;

  return (
    <PlacementQuestionScreen
      failures={phase.failures}
      number={number}
      onAnswer={onAnswer}
      onClose={onClose}
      onStop={onStop}
      pending={pending}
      position={[facts.question({ number, total: sitting.questions })]}
      progress={sitting.questions > 0 ? sitting.answered / sitting.questions : 0}
      question={phase.question}
      stopHint={
        sitting.hint === "manyUnknown"
          ? t(
              "Haven't studied most of this yet? That's fine. You can stop here and start learning.",
            )
          : undefined
      }
      subject={sitting.subject?.name ?? subject}
      trueFalseLabels={phase.trueFalseLabels}
    />
  );
}

export function FocusTestFlow({
  actions,
  asked = false,
  goalId,
  host,
  onDone,
  plan = null,
  readWarmUp,
  run,
  subject,
}: {
  actions: FocusTestActions;
  /** The learner asked for the test on the screen that led here, so it starts as it opens. */
  asked?: boolean;
  goalId: string;
  host: FocusTestHost;
  /** Leaves the test: onboarding saves its step, a plan goes back to it. False when it didn't. */
  onDone: () => Promise<boolean>;
  plan?: FocusTestPlanActions | null;
  readWarmUp: OnboardingActions["readWarmUp"];
  run: GenerationRun | null;
  /** The goal's name, over a question whose subject isn't known. */
  subject: string;
}) {
  const analytics = useTestAnalytics({ goalId, surface: host, test: "focus" });
  const test = useFocusTest({ actions, analytics, asked, onDone, run });
  const { failed, phase, pressed } = test;
  const onboarding = host === "onboarding";
  const sitting = phase.kind === "question" ? phase.sitting : null;

  useFirstQuestionShown({
    onShown: () =>
      sitting &&
      analytics.firstQuestionShown({ number: sitting.answered + 1, questions: sitting.questions }),
    sitting: sitting && `sitting:${test.sittingsStarted}`,
  });

  const waitLeave = useWaitLeave(onboarding);
  const seeResult = useSeeResultLabel();

  // Only onboarding has a skip to save: a plan that's already there just goes back to itself.
  const skip = (button: "main" | "other") => test.onLeave({ button, closes: onboarding });

  switch (phase.kind) {
    case "loading":
      return <StepLoading />;
    case "loadFailed":
      return <StepLoadFailed onRetry={test.reopen} />;
    case "waiting":
      return (
        <PlacementWaiting
          buildFailed={test.buildFailed}
          existingPlan={host === "plan"}
          onQuestions={test.continueWait}
          onSkip={() =>
            phase.answered ? test.onLeave({ button: "other", closes: true }) : skip("other")
          }
          poll={test.poll}
          questionsReady={test.questionsReady}
          readWarmUp={readWarmUp}
          run={run}
          skip={phase.answered ? { label: seeResult, note: null } : waitLeave}
          skipFailed={failed}
          skipping={pressed === "other"}
        />
      );
    case "unavailable":
      return (
        <PlacementUnavailable
          failed={failed}
          onContinue={() => skip("main")}
          pending={test.isPending}
        />
      );
    case "invitation":
      return (
        <FocusTestInvitation
          failed={failed}
          host={host}
          next={phase.next}
          onShown={() =>
            analytics.offered({
              preselected: "quick",
              questions: phase.next.questions,
              rows: onboarding ? ["first_lesson", "quick"] : ["quick"],
            })
          }
          onSkip={() => {
            analytics.notNow({ questions: phase.next.questions });
            skip(onboarding ? "main" : "other");
          }}
          onStart={test.onStart}
          pressed={pressed}
          suggestsFocus={phase.focusTest.suggestsFocus}
        />
      );
    case "question":
      return (
        <FocusTestQuestion
          key={phase.question.itemId}
          onAnswer={test.answer(phase)}
          onClose={() =>
            analytics.left({
              number: phase.sitting.answered + 1,
              questions: phase.sitting.questions,
            })
          }
          onStop={() => test.stop(phase)}
          pending={test.isPending}
          phase={phase}
          subject={subject}
        />
      );
    case "ended":
      return <FocusTestEnded failed={failed} onFinish={test.onFinish} pending={test.isPending} />;
    case "checkpoint":
      return (
        <FocusTestCheckpoint
          failed={failed}
          focusTest={phase.focusTest}
          host={host}
          onContinueTest={test.onContinueTest}
          onDone={test.onDone}
          plan={plan}
          pressed={pressed}
        />
      );
    default:
      return phase satisfies never;
  }
}
