"use client";

import { useExtracted } from "next-intl";
import { type OnboardingActions } from "../onboarding/onboarding-actions";
import { PlacementQuestionScreen } from "../onboarding/steps/placement-question";
import { PlacementDone } from "../onboarding/steps/placement-screens";
import { PlacementWaiting } from "../onboarding/steps/placement-waiting";
import { StepLoadFailed, StepLoading } from "../onboarding/steps/step-parts";
import { type PlacementTestActions } from "./placement-test-actions";
import {
  PlacementBetweenParts,
  PlacementLengthChoice,
  PlacementResult,
} from "./placement-test-screens";
import { usePlacementTest } from "./use-placement-test";

export function PlacementTestFlow({
  actions,
  onDone,
  readWarmUp,
  subject,
  wholeCourseMinutes,
}: {
  actions: PlacementTestActions;
  /** Goes back to the plan, read again; false when it didn't. */
  onDone: () => Promise<boolean>;
  readWarmUp: OnboardingActions["readWarmUp"];
  /** The goal's name, over each question. */
  subject: string;
  /** The whole-course test's length before it starts. */
  wholeCourseMinutes: number;
}) {
  const t = useExtracted();
  const test = usePlacementTest({ actions, onDone });
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
          pressed={pressed}
          wholeCourseMinutes={wholeCourseMinutes}
        />
      );
    case "waiting":
      return (
        <PlacementWaiting
          buildFailed={false}
          onQuestions={test.continueWait}
          onSkip={test.onLeave}
          poll={test.poll}
          questionsReady={test.questionsReady}
          readWarmUp={readWarmUp}
          run={null}
          skip={{ label: t("Not now"), note: null }}
          skipFailed={failed}
          skipping={pressed === "other"}
        />
      );
    case "question":
      return (
        <PlacementQuestionScreen
          failures={phase.failures}
          key={phase.question.itemId}
          number={phase.answered + 1}
          onAnswer={test.answer(phase)}
          onStop={() => test.stop(phase)}
          pending={test.isPending}
          position={
            phase.attempt.length === "wholeCourse"
              ? t("Part {part, number}", { part: phase.attempt.part })
              : undefined
          }
          progress={phase.progress}
          question={phase.question}
          subject={subject}
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
    case "between":
      return (
        <PlacementBetweenParts
          failed={failed}
          lessonsSkipped={phase.lessonsSkipped}
          minutesLeft={phase.attempt.estimatedMinutes}
          onFinishForToday={test.onLeave}
          onKeepGoing={() => test.onKeepGoing(phase.attempt.length)}
          pressed={pressed}
        />
      );
    case "result":
      return (
        <PlacementResult
          failed={failed}
          length={phase.length}
          lessonsSkipped={phase.lessonsSkipped}
          nextTopic={phase.nextTopic}
          onDone={test.onDone}
          pressed={pressed}
        />
      );
    default:
      return phase satisfies never;
  }
}
