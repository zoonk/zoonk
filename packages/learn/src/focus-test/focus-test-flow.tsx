"use client";

import { useExtracted } from "next-intl";
import { type GenerationRun } from "../generation/generation-run";
import { type OnboardingActions, type PlacementAnswer } from "../onboarding/onboarding-actions";
import { PlacementQuestionScreen } from "../onboarding/steps/placement-question";
import { PlacementUnavailable } from "../onboarding/steps/placement-screens";
import { PlacementWaiting } from "../onboarding/steps/placement-waiting";
import { StepLoading } from "../onboarding/steps/step-parts";
import { type FocusTestActions } from "./focus-test-actions";
import { type QuestionPhase } from "./focus-test-phase";
import { type FocusTestPlanActions } from "./focus-test-proposal";
import {
  FocusTestCheckpoint,
  FocusTestEnded,
  type FocusTestHost,
  FocusTestInvitation,
  FocusTestResume,
} from "./focus-test-screens";
import { useFocusTest } from "./use-focus-test";
import { getSubjectName } from "./use-focus-test-texts";

function useWaitSkip({ answered, host }: { answered: boolean; host: FocusTestHost }) {
  const t = useExtracted();

  if (answered) {
    return { label: t("Use my answers"), note: null };
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
      stopLabel={t("Stop and use my answers")}
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
  subject,
}: {
  actions: FocusTestActions;
  host: FocusTestHost;
  /** Leaves the test: onboarding saves its step, a plan goes back to it. False when it didn't. */
  onDone: () => Promise<boolean>;
  plan?: FocusTestPlanActions | null;
  readWarmUp: OnboardingActions["readWarmUp"];
  run: GenerationRun | null;
  /** The goal's name, over every screen but a question, which names its own subject. */
  subject: string;
}) {
  const test = useFocusTest({ actions, onDone, run });
  const { failed, phase, pressed } = test;
  const waitSkip = useWaitSkip({ answered: phase.kind === "waiting" && phase.answered, host });
  // Only onboarding has a skip to save: a plan that's already there just goes back to itself.
  const skip = () => test.onLeave(host === "onboarding");

  switch (phase.kind) {
    case "loading":
      return <StepLoading />;
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
          skipping={test.isPending}
        />
      );
    case "unavailable":
      return <PlacementUnavailable onContinue={skip} pending={test.isPending} />;
    case "invitation":
      return (
        <FocusTestInvitation
          failed={failed}
          focusTest={phase.focusTest}
          host={host}
          next={phase.next}
          onSkip={skip}
          onStart={test.onStart}
          pressed={pressed}
          subject={subject}
        />
      );
    case "resume":
      return (
        <FocusTestResume
          failed={failed}
          onContinue={() => test.resume(phase.question)}
          onUseAnswers={() => test.onLeave(true)}
          pressed={pressed}
          sitting={phase.question.sitting}
          subject={subject}
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
      return (
        <FocusTestEnded
          end={phase.end}
          failed={failed}
          onFinish={() => test.onFinish(phase.end)}
          pending={test.isPending}
          subject={subject}
        />
      );
    case "checkpoint":
      return (
        <FocusTestCheckpoint
          end={phase.end}
          failed={failed}
          focusTest={phase.focusTest}
          host={host}
          onContinueTest={test.onContinueTest}
          onDone={test.onDone}
          plan={plan}
          pressed={pressed}
          subject={subject}
        />
      );
    default:
      return phase satisfies never;
  }
}
