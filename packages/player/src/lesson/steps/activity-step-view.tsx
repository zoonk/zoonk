"use client";

import { ActivityStep } from "../../activities/activity-step";
import { LessonStepPicture, useIsRequiredPictureDrawing } from "../_components/lesson-pictures";
import { type LessonStepViewProps, type StepOf } from "./lesson-step-view-props";

export function ActivityStepView({
  answer,
  isLocked,
  onAnswer,
  result,
  step,
}: LessonStepViewProps<StepOf<"activity">>) {
  const isRequiredPictureDrawing = useIsRequiredPictureDrawing(step);

  return (
    <ActivityStep
      answer={answer?.kind === "activity" ? answer.answer : null}
      content={step.content}
      isCorrect={result ? result.isCorrect : null}
      isLocked={isRequiredPictureDrawing}
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
