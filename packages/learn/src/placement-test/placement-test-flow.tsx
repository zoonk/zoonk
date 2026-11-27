"use client";

import { useExtracted } from "next-intl";
import { type GenerationRun } from "../generation/generation-run";
import {
  type OnboardingActions,
  type PlacementAttemptView,
} from "../onboarding/onboarding-actions";
import { OnboardingTask } from "../onboarding/onboarding-frame";
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
import { type PlacementTestPhase } from "./placement-test-phase";
import { PlacementResult } from "./placement-test-screens";
import { type PlacementTestHost, usePlacementTest } from "./use-placement-test";
import {
  type TestAnalytics,
  type TestFactsNow,
  useFirstQuestionShown,
  useTestAnalytics,
} from "./use-test-analytics";

function toSittingFacts(attempt: PlacementAttemptView): TestFactsNow {
  return {
    attemptId: attempt.id,
    part: attempt.part,
    parts: attempt.parts,
    questions: attempt.questions,
  };
}

type Flow = {
  actions: PlacementTestActions;
  analytics: TestAnalytics;
  onStartLesson?: (lessonId: string) => Promise<boolean>;
  onboarding: boolean;
  readWarmUp: OnboardingActions["readWarmUp"];
  run: GenerationRun | null;
  /** The goal's name, over a question whose chapter isn't known. */
  subject: string;
  test: ReturnType<typeof usePlacementTest>;
  waitLeave: ReturnType<typeof useWaitLeave>;
};

type OpenPhase = Exclude<
  PlacementTestPhase,
  { kind: "continue" | "loadFailed" | "loading" | "offer" }
>;

/** The test once it's open: its questions, the wait for them and its result, each a task screen. */
function PlacementOpenTest({
  actions,
  analytics,
  onStartLesson,
  onboarding,
  phase,
  readWarmUp,
  run,
  subject,
  test,
  waitLeave,
}: Flow & { phase: OpenPhase }) {
  const t = useExtracted();
  const { failed, pressed } = test;

  switch (phase.kind) {
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
        <PlacementQuestionScreen
          answered={phase.attempt.answered}
          failures={phase.failures}
          key={phase.question.itemId}
          onAnswer={test.answer(phase)}
          onClose={() =>
            analytics.left({ ...toSittingFacts(phase.attempt), number: phase.attempt.answered + 1 })
          }
          onStop={() => test.stop(phase)}
          pending={test.isPending}
          question={phase.question}
          subject={phase.attempt.chapter?.trim() || subject}
          total={phase.attempt.questions}
          trueFalseLabels={phase.trueFalseLabels}
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
    case "result":
      return (
        <PlacementResult
          failed={failed}
          onDone={() => test.onLeave("main", phase.attemptId)}
          onStartLesson={(lessonId) => {
            analytics.lessonStarted({ attemptId: phase.attemptId, lessonId });
            test.onOpenLesson(lessonId, onStartLesson);
          }}
          onboarding={onboarding}
          pressed={pressed}
          result={phase}
          undo={{ changeId: phase.changeId, onUndo: actions.undo }}
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
          firstLesson={host.firstLesson}
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
    case "continue":
      return (
        <PlacementContinue
          attempt={phase.attempt}
          failed={failed}
          onContinue={() => test.onContinue(phase.attempt)}
          onLeave={() => {
            analytics.notNow(toSittingFacts(phase.attempt));
            test.onLeave("other", phase.attempt.id);
          }}
          onShown={(offered) => analytics.offered({ ...offered, ...toSittingFacts(phase.attempt) })}
          pressed={pressed}
        />
      );
    case "waiting":
    case "unavailable":
    case "question":
    case "partOver":
    case "result":
      return (
        <OnboardingTask>
          <PlacementOpenTest
            actions={actions}
            analytics={analytics}
            onStartLesson={onStartLesson}
            onboarding={onboarding}
            phase={phase}
            readWarmUp={readWarmUp}
            run={run}
            subject={subject}
            test={test}
            waitLeave={waitLeave}
          />
        </OnboardingTask>
      );
    default:
      return phase satisfies never;
  }
}
