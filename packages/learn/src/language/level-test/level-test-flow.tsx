"use client";

import { type GoalView } from "@zoonk/core/goals/contract";
import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { type OnboardingActions } from "../../onboarding/onboarding-actions";
import { PlanReceipt } from "../../onboarding/plan-receipt";
import { PlacementDone } from "../../onboarding/steps/placement-screens";
import { useWaitLeave } from "../../onboarding/steps/placement-waiting";
import { StepLoadFailed, StepLoading } from "../../onboarding/steps/step-parts";
import {
  type TestAnalytics,
  useFirstQuestionShown,
  useTestAnalytics,
} from "../../placement-test/use-test-analytics";
import { LevelTestOfferStep } from "./level-test-offer";
import { LevelTestOutScreens } from "./level-test-out-screens";
import { type LevelTestPhase } from "./level-test-phase";
import { LevelTestPreparing } from "./level-test-preparing";
import { LevelTestQuestion, useLevelTestAudio } from "./level-test-questions";
import { LevelResult } from "./level-test-results";
import {
  type LanguagePlanTestActions,
  type LevelTestHost,
  useLanguagePlanTest,
} from "./use-language-plan-test";

export type { LanguagePlanTestActions } from "./use-language-plan-test";

/** Says the first question the learner sees of the level test and of a test-out. */
function useQuestionsShown({
  analytics,
  phase,
  testOutAnalytics,
}: {
  analytics: TestAnalytics;
  phase: LevelTestPhase;
  testOutAnalytics: TestAnalytics;
}) {
  const asked = phase.kind === "test" ? phase : null;
  const testOut = phase.kind === "testOut" ? phase.view : null;

  useFirstQuestionShown({
    onShown: () =>
      asked &&
      analytics.firstQuestionShown({
        attemptId: asked.attemptId,
        number: asked.test.answered + 1,
        questions: asked.test.total,
      }),
    sitting: asked && asked.attemptId,
  });

  useFirstQuestionShown({
    onShown: () =>
      testOut &&
      testOutAnalytics.firstQuestionShown({
        attemptId: testOut.attemptId,
        number: testOut.answered + 1,
        questions: testOut.total,
      }),
    sitting: testOut && testOut.attemptId,
  });
}

type LanguagePlanTestProps = {
  actions: LanguagePlanTestActions;
  goalId: string;
  /** Onboarding's plan so far, beside the result. */
  goal?: GoalView;
  host: LevelTestHost;
  /** Leaves the test: onboarding goes on with setup, the Plan is read again. False when it didn't. */
  onLeave: () => Promise<boolean>;
  /** Opens a lesson from a result on the Plan. */
  onStartLesson?: (lessonId: string) => Promise<boolean>;
  readWarmUp: OnboardingActions["readWarmUp"];
  targetLanguage: string;
  /** Opened from a lesson's offer to test out of a level, so that choice comes picked. */
  testOutFirst?: boolean;
  /** The next level the learner can test out of; null when none is left. */
  testOutLevel: string | null;
  trueFalseLabels: TrueFalseLabels;
};

export function LanguagePlanTestFlow({
  actions,
  goal,
  goalId,
  host,
  onLeave,
  onStartLesson,
  readWarmUp,
  targetLanguage,
  testOutFirst = false,
  testOutLevel,
  trueFalseLabels,
}: LanguagePlanTestProps) {
  const { surface } = host;
  const analytics = useTestAnalytics({ goalId, surface, test: "language" });
  const testOutAnalytics = useTestAnalytics({ goalId, surface, test: "level_test_out" });
  const test = useLanguagePlanTest({ actions, analytics, host, onLeave });
  const { failed, phase, pressed } = test;
  const onboarding = surface === "onboarding";
  const waitLeave = useWaitLeave(onboarding);
  useQuestionsShown({ analytics, phase, testOutAnalytics });

  const startTestOut = (level: string, button: "main" | "other") => {
    testOutAnalytics.markStarted();
    test.onTestOut(level, button);
  };

  const audioPending = useLevelTestAudio({
    onRead: (view) => {
      if (phase.kind === "test") {
        test.onView(phase.attemptId)(view);
      }
    },
    read: actions.get,
    test: phase.kind === "test" ? phase.test : null,
  });

  switch (phase.kind) {
    case "loading":
      return <StepLoading />;
    case "loadFailed":
      return <StepLoadFailed onRetry={test.reopen} />;
    case "offer":
      return (
        <LevelTestOfferStep
          analytics={analytics}
          offer={phase.offer}
          onStartTestOut={(level) => startTestOut(level, "main")}
          onboarding={onboarding}
          test={test}
          testOutFirst={testOutFirst}
          testOutLevel={testOutLevel}
        />
      );
    case "waiting":
      return (
        <LevelTestPreparing
          leave={waitLeave}
          onSkip={() => test.onLeave("other")}
          run={test.bankRun}
          skipping={pressed === "other"}
        />
      );
    case "test":
      return (
        <LevelTestQuestion
          answer={(input) => actions.answer({ ...input, attemptId: phase.attemptId })}
          audioPending={audioPending}
          onClose={() =>
            analytics.left({
              attemptId: phase.attemptId,
              number: phase.test.answered + 1,
              questions: phase.test.total,
            })
          }
          onStop={() => test.onStop(phase.attemptId)}
          onView={test.onView(phase.attemptId)}
          targetLanguage={targetLanguage}
          test={phase.test}
        />
      );
    case "finish":
    case "testOutFinish":
      return (
        <PlacementDone
          failed={failed}
          onContinue={() =>
            phase.kind === "finish"
              ? test.onStop(phase.attemptId)
              : test.onTestOutStop(phase.attemptId)
          }
          pending={test.isPending}
        />
      );
    case "result":
      return (
        <LevelResult
          failed={failed}
          onDone={() => test.onLeave("main")}
          onStartLesson={(lessonId) => {
            analytics.lessonStarted({ attemptId: phase.result?.attemptId, lessonId });
            test.onOpenLesson(lessonId, onStartLesson);
          }}
          onTestOut={(level) => startTestOut(level, "other")}
          onUndo={actions.undo}
          onboarding={onboarding}
          pressed={pressed}
          rail={goal && <PlanReceipt goal={goal} testRanges={phase.result?.ranges ?? null} />}
          result={phase.result}
          targetLanguage={targetLanguage}
          testOutLevel={onboarding ? null : phase.nextTestOutLevel}
        />
      );
    case "testOut":
    case "testOutWaiting":
    case "testOutResult":
      return (
        <LevelTestOutScreens
          analytics={testOutAnalytics}
          onUndo={actions.undo}
          phase={phase}
          readWarmUp={readWarmUp}
          test={test}
          trueFalseLabels={trueFalseLabels}
        />
      );
    default:
      return phase satisfies never;
  }
}
