"use client";

import { ActivityStep } from "../../activities/activity-step";
import { LessonStepPicture } from "../_components/lesson-pictures";
import { type LessonStepViewProps, type StepOf } from "./lesson-step-view-props";

/**
 * An interactive activity: the renderer draws the template and reports the learner's end state;
 * after the check it shows the expected state next to theirs with its own feedback.
 */
export function ActivityStepView({
  answer,
  isLocked,
  onAnswer,
  result,
  step,
}: LessonStepViewProps<StepOf<"activity">>) {
  return (
    <ActivityStep
      answer={answer?.kind === "activity" ? answer.answer : null}
      content={step.content}
      isCorrect={result ? result.isCorrect : null}
      onAnswerChange={(value) => {
        if (!isLocked) {
          onAnswer(value ? { answer: value, kind: "activity" } : null);
        }
      }}
      phase={result ? "checked" : "answering"}
      picture={<LessonStepPicture asks step={step} />}
    />
  );
}
