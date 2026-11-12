"use client";

import { useExtracted } from "next-intl";
import { type GenerationRun } from "../generation/generation-run";
import { type OnboardingActions, type PlacementAnswer } from "../onboarding/onboarding-actions";
import { PlacementQuestionScreen } from "../onboarding/steps/placement-question";
import { PlacementUnavailable } from "../onboarding/steps/placement-screens";
import { PlacementWaiting } from "../onboarding/steps/placement-waiting";
import { StepLoadFailed, StepLoading } from "../onboarding/steps/step-parts";
import { type FocusTestActions } from "./focus-test-actions";
import { type QuestionPhase } from "./focus-test-phase";
import { type FocusTestPlanActions } from "./focus-test-proposal";
import { FocusTestCheckpoint, type FocusTestHost } from "./focus-test-result";
import { FocusTestEnded, FocusTestInvitation, FocusTestResume } from "./focus-test-screens";
import { useFocusTest } from "./use-focus-test";
import { getSubjectName, useSeeResultLabel } from "./use-focus-test-texts";

function useWaitSkip({ answered, host }: { answered: boolean; host: FocusTestHost }) {
  const t = useExtracted();
  const seeResult = useSeeResultLabel();

  if (answered) {
    return { label: seeResult, note: null };
  }

  return host === "onboarding"
    ? { label: t("Skip for now"), note: t("You can take the test later, from your plan.") }
    : { label: t("Not now"), note: null };
}

function FocusTestQuestion({
  onAnswer,
  onStop,
  pending,
  phase,
  subject,
}: {
  onAnswer: (answer: PlacementAnswer, durationMs: number) => void;
  onStop: () => void;
  pending: boolean;
  phase: QuestionPhase;
  subject: string;
}) {
  const t = useExtracted();
  const { sitting } = phase;

  return (
    <PlacementQuestionScreen
      failures={phase.failures}
      number={sitting.answered + 1}
      onAnswer={onAnswer}
      onStop={onStop}
      pending={pending}
      progress={sitting.questions > 0 ? sitting.answered / sitting.questions : 0}
      question={phase.question}
      stopHint={
        sitting.hint === "manyUnknown"
          ? t(
              "Haven't studied most of this yet? That's fine. You can stop here and start learning.",
            )
          : undefined
      }
      subject={sitting.subject ? getSubjectName(sitting.subject) : subject}
      total={sitting.questions}
      trueFalseLabels={phase.trueFalseLabels}
    />
  );
}

export function FocusTestFlow({
  actions,
  host,
  onDone,
  plan = null,
  readWarmUp,
  run,
  started = false,
  subject,
}: {
  actions: FocusTestActions;
  host: FocusTestHost;
  /** Leaves the test: onboarding saves its step, a plan goes back to it. False when it didn't. */
  onDone: () => Promise<boolean>;
  plan?: FocusTestPlanActions | null;
  readWarmUp: OnboardingActions["readWarmUp"];
  run: GenerationRun | null;
  /** The learner pressed "Start" on the screen that led here, so it isn't offered again. */
  started?: boolean;
  /** The goal's name, over a question whose subject isn't known. */
  subject: string;
}) {
  const test = useFocusTest({ actions, onDone, run, started });
  const { failed, phase, pressed } = test;
  const waitSkip = useWaitSkip({ answered: phase.kind === "waiting" && phase.answered, host });
  // Only onboarding has a skip to save: a plan that's already there just goes back to itself.
  const skip = () => test.onLeave(host === "onboarding");

  switch (phase.kind) {
    case "loading":
      return <StepLoading />;
    case "loadFailed":
      return <StepLoadFailed onRetry={test.reopen} />;
    case "waiting":
      return (
        <PlacementWaiting
          buildFailed={test.buildFailed}
          onQuestions={test.continueWait}
          onSkip={phase.answered ? () => test.onLeave(true) : skip}
          poll={test.poll}
          questionsReady={test.questionsReady}
          readWarmUp={readWarmUp}
          run={run}
          skip={waitSkip}
          skipFailed={failed}
          skipping={test.isPending}
        />
      );
    case "unavailable":
      return <PlacementUnavailable failed={failed} onContinue={skip} pending={test.isPending} />;
    case "invitation":
      return (
        <FocusTestInvitation
          failed={failed}
          host={host}
          next={phase.next}
          onSkip={skip}
          onStart={test.onStart}
          pressed={pressed}
          suggestsFocus={phase.focusTest.suggestsFocus}
        />
      );
    case "resume":
      return (
        <FocusTestResume
          answered={phase.answered}
          failed={failed}
          onContinue={() => test.resume(phase.question)}
          onSeeResult={() => test.onLeave(true)}
          pressed={pressed}
          sitting={phase.question.sitting}
        />
      );
    case "question":
      return (
        <FocusTestQuestion
          key={phase.question.itemId}
          onAnswer={test.answer(phase)}
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
