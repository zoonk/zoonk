"use client";

import { LessonVisual } from "@zoonk/learn/visual";
import { PlayerChoiceScene, PlayerChoiceScenePrompt } from "../../components/player-choice-scene";
import { LessonChoiceOptions } from "../_components/lesson-choice-options";
import { LessonStepPicture, useIsPictureDrawing } from "../_components/lesson-pictures";
import { LessonContext, LessonQuestion } from "../_components/lesson-step-text";
import { ExplainFirstButton } from "../controls/explain-first-button";
import { type LessonStepViewProps, type StepOf } from "./lesson-step-view-props";

/**
 * A question in the middle of the lesson, with a reason behind every option. A question about a
 * picture still being drawn waits for it.
 */
export function CheckStepView({
  answer,
  isLocked,
  onAnswer,
  result,
  step,
}: LessonStepViewProps<StepOf<"check">>) {
  const selectedId = answer?.kind === "check" ? answer.optionId : null;
  const isPictureDrawing = useIsPictureDrawing(step);

  return (
    <PlayerChoiceScene>
      <PlayerChoiceScenePrompt>
        <LessonStepPicture asks step={step} />
        <LessonContext>{step.content.context}</LessonContext>
        <LessonVisual visual={step.content.visual} />
        <LessonQuestion>{step.content.question}</LessonQuestion>
      </PlayerChoiceScenePrompt>

      <LessonChoiceOptions
        isChecked={Boolean(result)}
        isLocked={isLocked || isPictureDrawing}
        onSelect={(optionId) => onAnswer(optionId ? { kind: "check", optionId } : null)}
        options={step.content.options}
        selectedId={selectedId}
      />

      <ExplainFirstButton />
    </PlayerChoiceScene>
  );
}
