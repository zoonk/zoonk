"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { useExtracted } from "next-intl";
import { type OnboardingActions } from "../../onboarding/onboarding-actions";
import { PlacementQuestionScreen } from "../../onboarding/steps/placement-question";
import { PlacementWaiting } from "../../onboarding/steps/placement-waiting";
import { StepLoadFailed, StepLoading } from "../../onboarding/steps/step-parts";
import { PlacementLengthChoice } from "../../placement-test/placement-test-screens";
import { LevelTestPreparing } from "./level-test-preparing";
import { LevelResult, TestOutResult } from "./level-test-results";
import { TestStep } from "./level-test-step";
import { type LanguagePlanTestActions, useLanguagePlanTest } from "./use-language-plan-test";

export type { LanguagePlanTestActions } from "./use-language-plan-test";

export function LanguagePlanTestFlow({
  actions,
  onDone,
  readWarmUp,
  targetLanguage,
  testOutFirst = false,
  testOutLevel,
  trueFalseLabels,
  wholeCourseMinutes,
}: {
  actions: LanguagePlanTestActions;
  /** Goes back to the plan, read again; false when it didn't. */
  onDone: () => Promise<boolean>;
  readWarmUp: OnboardingActions["readWarmUp"];
  targetLanguage: string;
  /** Opened from a lesson's offer to test out of a level, so that choice comes picked. */
  testOutFirst?: boolean;
  /** The next level the learner can test out of; null when none is left. */
  testOutLevel: string | null;
  trueFalseLabels: TrueFalseLabels;
  wholeCourseMinutes: number;
}) {
  const t = useExtracted();
  const test = useLanguagePlanTest({ actions, onDone });
  const { failed, phase, pressed } = test;

  switch (phase.kind) {
    case "loading":
      return <StepLoading />;
    case "loadFailed":
      return <StepLoadFailed onRetry={test.reopen} />;
    case "choose":
      return (
        <PlacementLengthChoice
          failed={failed}
          onStart={test.onStart}
          initialChoice={testOutFirst && testOutLevel ? "testOut" : "quick"}
          onTestOut={testOutLevel ? () => test.onTestOut(testOutLevel) : undefined}
          pressed={pressed}
          testOutLevel={testOutLevel}
          wholeCourseMinutes={wholeCourseMinutes}
        />
      );
    case "waiting":
      return (
        <LevelTestPreparing
          fromPlan
          onSkip={test.onLeave}
          run={test.bankRun}
          skipping={pressed === "other"}
          targetLanguage={targetLanguage}
        />
      );
    case "test":
      return (
        <TestStep
          actions={{
            answer: (input) => actions.answer({ ...input, attemptId: phase.attemptId }),
            speak: actions.speak,
          }}
          audioPending={false}
          next={phase.test.next}
          onStop={() => test.onStop(phase.attemptId, phase.test.length ?? "quick")}
          onView={test.onView(phase.attemptId)}
          progress={phase.test.answered / phase.test.total}
          targetLanguage={targetLanguage}
        />
      );
    case "result":
      return (
        <LevelResult
          failed={failed}
          length={phase.length}
          onDone={test.onDone}
          onTestOut={test.onTestOut}
          onWalkTopics={test.onWalkTopics}
          pressed={pressed}
          result={phase.result}
          targetLanguage={targetLanguage}
          testOutLevel={testOutLevel}
        />
      );
    case "testOut":
      return (
        <PlacementQuestionScreen
          failures={phase.failures}
          key={phase.question.itemId}
          number={phase.view.answered + 1}
          onAnswer={test.onTestOutAnswer(phase)}
          onStop={() => test.onTestOutStop(phase.view.attemptId)}
          pending={test.isPending}
          position={t("Question {number, number} of {total, number}", {
            number: phase.view.answered + 1,
            total: phase.view.total,
          })}
          progress={phase.view.answered / phase.view.total}
          question={phase.question}
          subject={t("Test out of {level}", { level: phase.view.level })}
          trueFalseLabels={trueFalseLabels}
        />
      );
    case "testOutWaiting":
      return (
        <PlacementWaiting
          buildFailed={false}
          onQuestions={test.continueTestOut}
          onSkip={test.onLeave}
          poll={test.testOutPoll}
          questionsReady={test.arrivedTestOut}
          readWarmUp={readWarmUp}
          run={null}
          skip={{ label: t("Not now"), note: null }}
          skipping={pressed === "other"}
        />
      );
    case "testOutResult":
      return <TestOutResult onDone={test.onDone} pressed={pressed} view={phase.view} />;
    default:
      return phase satisfies never;
  }
}
