"use client";

import { isLanguageStep } from "../_utils/lesson-steps";
import { type PlayableLibraryStep } from "../lesson-player-types";
import { ActivityStepView } from "./activity-step-view";
import { ChallengeStepView } from "./challenge/challenge-step";
import { CheckStepView } from "./check-step";
import { ExerciseStepView } from "./exercise-step";
import { ExplanationStepView } from "./explanation-step";
import { HookStepView } from "./hook-step";
import { type LessonStepViewProps } from "./lesson-step-view-props";
import { SpokenAnswerStepView } from "./spoken-answer-step";
import { SummaryStepView } from "./summary-step";
import { TypedAnswerStepView } from "./typed-answer-step";
import { WorkedExampleStepView } from "./worked-example-step";

/** Screens that show their own verdict (activities, challenges and today's inline exercises). */
const OWN_RESULT_KINDS = new Set<PlayableLibraryStep["kind"]>([
  "activity",
  "challenge",
  "fillBlank",
  "matchColumns",
]);

export function showsOwnResult(step: PlayableLibraryStep): boolean {
  return OWN_RESULT_KINDS.has(step.kind);
}

/** Renders one screen by its kind. */
export function LessonStepView(props: LessonStepViewProps) {
  const { step } = props;

  if (isLanguageStep(step)) {
    return <ExerciseStepView {...props} step={step} />;
  }

  switch (step.kind) {
    case "activity":
      return <ActivityStepView {...props} step={step} />;
    case "challenge":
      return <ChallengeStepView {...props} step={step} />;
    case "check":
      return <CheckStepView {...props} step={step} />;
    case "explanation":
      return <ExplanationStepView {...props} step={step} />;
    case "hook":
      return <HookStepView {...props} step={step} />;
    case "spokenAnswer":
      return <SpokenAnswerStepView {...props} step={step} />;
    case "summary":
      return <SummaryStepView {...props} step={step} />;
    case "typedAnswer":
      return <TypedAnswerStepView {...props} step={step} />;
    case "workedExample":
      return <WorkedExampleStepView {...props} step={step} />;
    default:
      return step satisfies never;
  }
}
