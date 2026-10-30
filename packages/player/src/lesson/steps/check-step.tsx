"use client";

import { LessonVisual } from "@zoonk/learn/visual";
import { PlayerChoiceScene, PlayerChoiceScenePrompt } from "../../components/player-choice-scene";
import { LessonChoiceOptions } from "../_components/lesson-choice-options";
import { LessonPictureOptions } from "../_components/lesson-picture-options";
import { LessonStepPicture, useIsRequiredPictureDrawing } from "../_components/lesson-pictures";
import { LessonContext, LessonQuestion } from "../_components/lesson-step-text";
import { ScreenSupport } from "../_components/screen-support";
import { splitQuestionData } from "../_utils/lesson-aside";
import { ExplainFirstButton } from "../controls/explain-first-button";
import { type LessonStepViewProps, type StepOf } from "./lesson-step-view-props";

export function CheckStepView({
  answer,
  isLocked,
  onAnswer,
  result,
  step,
}: LessonStepViewProps<StepOf<"check">>) {
  const selectedId = answer?.kind === "check" ? answer.optionId : null;
  const isRequiredPictureDrawing = useIsRequiredPictureDrawing(step);
  const hasPictureOptions = step.content.options.some((option) => option.picture);
  const { data, question } = splitQuestionData(step.content.question);

  function select(optionId: string | null) {
    onAnswer(optionId ? { kind: "check", optionId } : null);
  }

  return (
    <PlayerChoiceScene>
      <PlayerChoiceScenePrompt>
        <ScreenSupport>
          <LessonStepPicture asks step={step} />
          <LessonContext>{step.content.context}</LessonContext>
          <LessonVisual visual={step.content.visual} />
          <LessonContext>{data ?? undefined}</LessonContext>
        </ScreenSupport>
        <LessonQuestion>{question}</LessonQuestion>
      </PlayerChoiceScenePrompt>

      {hasPictureOptions ? (
        <LessonPictureOptions
          isChecked={Boolean(result)}
          isLocked={isLocked || isRequiredPictureDrawing}
          onSelect={select}
          options={step.content.options}
          selectedId={selectedId}
          step={step}
        />
      ) : (
        <LessonChoiceOptions
          isChecked={Boolean(result)}
          isLocked={isLocked || isRequiredPictureDrawing}
          onSelect={select}
          options={step.content.options}
          selectedId={selectedId}
        />
      )}

      <ExplainFirstButton />
    </PlayerChoiceScene>
  );
}
