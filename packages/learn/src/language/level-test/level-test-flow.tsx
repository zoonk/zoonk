"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { useExtracted } from "next-intl";
import { type OnboardingActions } from "../../onboarding/onboarding-actions";
import { PlacementQuestionScreen } from "../../onboarding/steps/placement-question";
import { PlacementDone } from "../../onboarding/steps/placement-screens";
import { PlacementWaiting } from "../../onboarding/steps/placement-waiting";
import { StepLoadFailed, StepLoading } from "../../onboarding/steps/step-parts";
import { PlacementLengthChoice } from "../../placement-test/placement-test-screens";
import { LevelTestPreparing } from "./level-test-preparing";
import { LevelResult, TestOutResult } from "./level-test-results";
import { TestIntro } from "./level-test-screens";
import { TestStep, useLevelTestAudio } from "./level-test-step";
import { type LanguagePlanTestActions, useLanguagePlanTest } from "./use-language-plan-test";

export type { LanguagePlanTestActions } from "./use-language-plan-test";

/** Onboarding's own way past the test, before one opens, and the learner's own language. */
type OnboardingLevelTest = {
  language: string;
  /** Goes on without a test; false when it didn't. */
  skip: () => Promise<boolean>;
  switchLanguage: (language: string) => void;
};

function LengthStep({
  onboarding,
  showAlphabetNote,
  test,
  testOutFirst,
  testOutLevel,
  wholeCourseMinutes,
}: {
  onboarding?: OnboardingLevelTest;
  showAlphabetNote: boolean;
  test: ReturnType<typeof useLanguagePlanTest>;
  testOutFirst: boolean;
  testOutLevel: string | null;
  wholeCourseMinutes: number;
}) {
  if (onboarding) {
    return (
      <TestIntro
        failed={test.failed}
        language={onboarding.language}
        onSkip={() => test.onSkip(onboarding.skip)}
        onStart={test.onStart}
        onSwitch={onboarding.switchLanguage}
        pressed={test.pressed}
        showAlphabetNote={showAlphabetNote}
        wholeCourseMinutes={wholeCourseMinutes}
      />
    );
  }

  return (
    <PlacementLengthChoice
      failed={test.failed}
      onStart={test.onStart}
      initialChoice={testOutFirst && testOutLevel ? "testOut" : "quick"}
      onTestOut={testOutLevel ? () => test.onTestOut(testOutLevel) : undefined}
      pressed={test.pressed}
      testOutLevel={testOutLevel}
      wholeCourseMinutes={wholeCourseMinutes}
    />
  );
}

export function LanguagePlanTestFlow({
  actions,
  onDone,
  onboarding,
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
  onboarding?: OnboardingLevelTest;
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
  const test = useLanguagePlanTest({ actions, onDone, onboarding: Boolean(onboarding) });
  const { failed, phase, pressed } = test;

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
    case "choose":
      return (
        <LengthStep
          onboarding={onboarding}
          showAlphabetNote={phase.showAlphabetNote}
          test={test}
          testOutFirst={testOutFirst}
          testOutLevel={testOutLevel}
          wholeCourseMinutes={wholeCourseMinutes}
        />
      );
    case "waiting":
      return (
        <LevelTestPreparing
          fromPlan={!onboarding}
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
          audioPending={audioPending}
          next={phase.test.next}
          onStop={() => test.onStop(phase.attemptId, phase.test.length ?? "quick")}
          onView={test.onView(phase.attemptId)}
          progress={phase.test.answered / phase.test.total}
          targetLanguage={targetLanguage}
        />
      );
    case "finish":
      return (
        <PlacementDone
          failed={failed}
          onContinue={() => test.onStop(phase.attemptId, phase.length)}
          pending={test.isPending}
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
          onboarding={Boolean(onboarding)}
          pressed={pressed}
          result={phase.result}
          targetLanguage={targetLanguage}
          testOutLevel={onboarding ? null : phase.nextTestOutLevel}
          onUndo={actions.undo}
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
          existingPlan
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
      return (
        <TestOutResult
          onDone={test.onDone}
          onUndo={actions.undo}
          pressed={pressed}
          view={phase.view}
        />
      );
    default:
      return phase satisfies never;
  }
}
