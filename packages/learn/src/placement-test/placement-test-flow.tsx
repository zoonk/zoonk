"use client";

import { useExtracted } from "next-intl";
import { type GenerationRun } from "../generation/generation-run";
import {
  type OnboardingActions,
  type PlacementAttemptView,
} from "../onboarding/onboarding-actions";
import { PlacementQuestionScreen } from "../onboarding/steps/placement-question";
import { PlacementDone, PlacementUnavailable } from "../onboarding/steps/placement-screens";
import { PlacementWaiting, useWaitLeave } from "../onboarding/steps/placement-waiting";
import { StepLoadFailed, StepLoading } from "../onboarding/steps/step-parts";
import { type PlacementTestActions } from "./placement-test-actions";
import {
  CoursePlanOffer,
  CourseStartOffer,
  type CourseTestOffer,
  PlacementContinue,
} from "./placement-test-offers";
import { type PlacementQuestionPhase, type PlacementTestPhase } from "./placement-test-phase";
import { PlacementCheckpoint, PlacementResult, PlacementStopped } from "./placement-test-screens";
import { type PlacementTestHost, usePlacementTest } from "./use-placement-test";
import {
  type TestAnalytics,
  type TestFactsNow,
  useFirstQuestionShown,
  useTestAnalytics,
} from "./use-test-analytics";
import { useTestFacts } from "./use-test-facts";

function PlacementQuestion({
  onAnswer,
  onClose,
  onStop,
  pending,
  phase,
  subject,
}: {
  onAnswer: React.ComponentProps<typeof PlacementQuestionScreen>["onAnswer"];
  onClose: (number: number) => void;
  onStop: () => void;
  pending: boolean;
  phase: PlacementQuestionPhase;
  subject: string;
}) {
  const facts = useTestFacts();
  const { attempt } = phase;
  const number = attempt.answered + 1;
  const question = facts.question({ number, total: attempt.questions });

  return (
    <PlacementQuestionScreen
      failures={phase.failures}
      number={number}
      onAnswer={onAnswer}
      onClose={() => onClose(number)}
      onStop={onStop}
      pending={pending}
      position={
        attempt.length === "wholeCourse"
          ? [facts.part({ part: attempt.part, parts: attempt.parts }), question]
          : [question]
      }
      progress={attempt.answered / attempt.questions}
      question={phase.question}
      subject={attempt.chapter?.trim() || subject}
      trueFalseLabels={phase.trueFalseLabels}
    />
  );
}

function toSittingFacts(attempt: PlacementAttemptView): TestFactsNow {
  return {
    attemptId: attempt.id,
    part: attempt.part,
    parts: attempt.parts,
    questions: attempt.questions,
  };
}

type AfterSitting = Extract<
  PlacementTestPhase,
  { kind: "checkpoint" | "continue" | "result" | "stopped" }
>;

/** Where a sitting leaves the learner: a full test's place between parts, or a test's result. */
function PlacementAfterSitting({
  analytics,
  onStartLesson,
  onUndo,
  onboarding,
  phase,
  test,
}: {
  analytics: TestAnalytics;
  onStartLesson?: (lessonId: string) => Promise<boolean>;
  onUndo: PlacementTestActions["undo"];
  onboarding: boolean;
  phase: AfterSitting;
  test: ReturnType<typeof usePlacementTest>;
}) {
  const t = useExtracted();
  const { failed, pressed } = test;
  const undo = (changeId: string | null) => ({ changeId, onUndo });

  switch (phase.kind) {
    case "continue":
      return (
        <PlacementContinue
          attempt={phase.attempt}
          failed={failed}
          onContinue={test.onContinue}
          onLeave={() => {
            analytics.notNow(toSittingFacts(phase.attempt));
            test.onLeave("other", phase.attempt.id);
          }}
          onShown={(offered) => analytics.offered({ ...offered, ...toSittingFacts(phase.attempt) })}
          pressed={pressed}
        />
      );
    case "checkpoint":
      return (
        <PlacementCheckpoint
          attempt={phase.attempt}
          failed={failed}
          heldUntilTomorrow={phase.heldUntilTomorrow}
          lessonsSkipped={phase.lessonsSkipped}
          onFinishLater={() => test.onLeave("other", phase.attempt.id)}
          onKeepGoing={test.onContinue}
          pressed={pressed}
          undo={undo(phase.changeId)}
        />
      );
    case "stopped":
      return (
        <PlacementStopped
          attempt={phase.attempt}
          doneLabel={onboarding ? t("Continue") : t("Done")}
          failed={failed}
          heldUntilTomorrow={phase.heldUntilTomorrow}
          lessonsSkipped={phase.lessonsSkipped}
          onDone={() => test.onLeave("main", phase.attempt.id)}
          pressed={pressed}
          undo={undo(phase.changeId)}
        />
      );
    case "result":
      return (
        <PlacementResult
          failed={failed}
          onDone={() => test.onLeave("main", phase.attemptId)}
          onStartLesson={(lessonId) => {
            analytics.lessonStarted({ attemptId: phase.attemptId, lessonId });
            test.onOpenLesson(lessonId, onStartLesson);
          }}
          onTestTheRest={test.onTestTheRest}
          onboarding={onboarding}
          pressed={pressed}
          result={phase}
          undo={undo(phase.changeId)}
        />
      );
    default:
      return phase satisfies never;
  }
}

export function PlacementTestFlow({
  actions,
  goalId,
  host,
  offer,
  onLeave,
  onStartLesson,
  readWarmUp,
  run = null,
  subject,
}: {
  actions: PlacementTestActions;
  goalId: string;
  host: PlacementTestHost;
  /** What the test asks before it starts, from the server. */
  offer: CourseTestOffer;
  /** Leaves the test: onboarding goes on with setup, the Plan is read again. False when it didn't. */
  onLeave: (attemptId?: string) => Promise<boolean>;
  /** Opens a lesson from a result on the Plan. */
  onStartLesson?: (lessonId: string) => Promise<boolean>;
  readWarmUp: OnboardingActions["readWarmUp"];
  run?: GenerationRun | null;
  /** The goal's name, over a question whose chapter isn't known. */
  subject: string;
}) {
  const t = useExtracted();
  const analytics = useTestAnalytics({ goalId, surface: host.surface, test: "course" });
  const test = usePlacementTest({ actions, analytics, host, onLeave, run });
  const { failed, phase, pressed } = test;
  const onboarding = host.surface === "onboarding";
  const asked = phase.kind === "question" ? phase.attempt : null;

  useFirstQuestionShown({
    onShown: () =>
      asked &&
      analytics.firstQuestionShown({ ...toSittingFacts(asked), number: asked.answered + 1 }),
    sitting: asked && `${asked.id}:${asked.part}`,
  });

  const waitLeave = useWaitLeave(onboarding);

  switch (phase.kind) {
    case "loading":
      return <StepLoading />;
    case "loadFailed":
      return <StepLoadFailed onRetry={test.reopen} />;
    case "offer":
      return host.surface === "onboarding" ? (
        <CourseStartOffer
          failed={failed}
          levelGiven={host.levelGiven}
          offer={offer}
          onFirstLesson={test.onDecline}
          onShown={analytics.offered}
          onStart={test.onStart}
          pressed={pressed}
        />
      ) : (
        <CoursePlanOffer
          failed={failed}
          offer={offer}
          onNotNow={() => {
            analytics.notNow();
            test.onLeave("other");
          }}
          onShown={analytics.offered}
          onStart={test.onStart}
          pressed={pressed}
        />
      );
    case "waiting":
      return (
        <PlacementWaiting
          buildFailed={Boolean(phase.buildFailed)}
          existingPlan={!onboarding}
          onQuestions={test.continueWait}
          onSkip={() => test.onLeave("other")}
          poll={test.poll}
          questionsReady={test.questionsReady}
          readWarmUp={readWarmUp}
          retry={phase.retryLength ? test.onRetryWait : undefined}
          run={run}
          skip={waitLeave}
          skipFailed={failed}
          skipping={pressed === "other"}
        />
      );
    case "unavailable":
      return (
        <PlacementUnavailable
          continueLabel={onboarding ? undefined : t("Done")}
          failed={failed}
          onContinue={() => test.onLeave("main")}
          pending={test.isPending}
        />
      );
    case "question":
      return (
        <PlacementQuestion
          key={phase.question.itemId}
          onAnswer={test.answer(phase)}
          onClose={(number) => analytics.left({ ...toSittingFacts(phase.attempt), number })}
          onStop={() => test.stop(phase)}
          pending={test.isPending}
          phase={phase}
          subject={subject}
        />
      );
    case "partOver":
      return (
        <PlacementDone
          failed={failed}
          onContinue={() => test.onFinishPart(phase.attempt)}
          pending={test.isPending}
        />
      );
    case "continue":
    case "checkpoint":
    case "stopped":
    case "result":
      return (
        <PlacementAfterSitting
          analytics={analytics}
          onStartLesson={onStartLesson}
          onUndo={actions.undo}
          onboarding={onboarding}
          phase={phase}
          test={test}
        />
      );
    default:
      return phase satisfies never;
  }
}
