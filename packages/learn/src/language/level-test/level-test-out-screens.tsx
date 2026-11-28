"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { useExtracted } from "next-intl";
import { type OnboardingActions } from "../../onboarding/onboarding-actions";
import { PlacementQuestionScreen } from "../../onboarding/steps/placement-question";
import { PlacementWaiting } from "../../onboarding/steps/placement-waiting";
import { type TestAnalytics } from "../../placement-test/use-test-analytics";
import { ItemSetStimulus } from "../../questions/item-set-stimulus";
import { type LevelTestPhase } from "./level-test-phase";
import { TestOutResult } from "./level-test-results";
import { type useLanguagePlanTest } from "./use-language-plan-test";

/** A level's test-out once it's open: its questions, the wait for them and its result. */
export function LevelTestOutScreens({
  analytics,
  onUndo,
  phase,
  readWarmUp,
  test,
  trueFalseLabels,
}: {
  analytics: TestAnalytics;
  onUndo: (changeId: string) => Promise<boolean>;
  phase: Extract<LevelTestPhase, { kind: "testOut" | "testOutResult" | "testOutWaiting" }>;
  readWarmUp: OnboardingActions["readWarmUp"];
  test: ReturnType<typeof useLanguagePlanTest>;
  trueFalseLabels: TrueFalseLabels;
}) {
  const t = useExtracted();
  const { pressed } = test;

  switch (phase.kind) {
    case "testOut": {
      const { question, view } = phase;
      const askedIn = `${view.attemptId}:${question.itemId}`;

      return (
        <PlacementQuestionScreen
          failures={phase.failures}
          key={question.itemId}
          media={question.set && <ItemSetStimulus askedIn={askedIn} set={question.set} />}
          answered={view.answered}
          onAnswer={test.onTestOutAnswer(phase)}
          onClose={() =>
            analytics.left({
              attemptId: view.attemptId,
              number: view.answered + 1,
              questions: view.total,
            })
          }
          onStop={() => test.onTestOutStop(view.attemptId)}
          pending={test.isPending}
          question={question}
          subject={t("Test out of {level}", { level: view.level })}
          total={view.total}
          trueFalseLabels={trueFalseLabels}
        />
      );
    }
    case "testOutWaiting":
      return (
        <PlacementWaiting
          buildFailed={false}
          existingPlan
          onQuestions={test.continueTestOut}
          onSkip={() => test.onLeave("other")}
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
          onDone={() => test.onLeave("main")}
          onUndo={onUndo}
          pressed={pressed}
          view={phase.view}
        />
      );
    default:
      return phase satisfies never;
  }
}
