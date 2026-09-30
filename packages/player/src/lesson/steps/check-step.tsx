"use client";

import { PlayerChoiceScene, PlayerChoiceScenePrompt } from "../../components/player-choice-scene";
import { LessonChoiceOptions } from "../_components/lesson-choice-options";
import { LessonQuestionPicture } from "../_components/lesson-step-image";
import { LessonContext, LessonQuestion } from "../_components/lesson-step-text";
import { ExplainFirstButton } from "../controls/explain-first-button";
import { type LessonStepViewProps, type StepOf } from "./lesson-step-view-props";

/** A question in the middle of the lesson, with a reason behind every option. */
export function CheckStepView({
  answer,
  isLocked,
  onAnswer,
  result,
  step,
}: LessonStepViewProps<StepOf<"check">>) {
  const selectedId = answer?.kind === "check" ? answer.optionId : null;

  return (
    <PlayerChoiceScene>
      <PlayerChoiceScenePrompt>
        <LessonQuestionPicture image={step.image} request={step.content.image} />
        <LessonContext>{step.content.context}</LessonContext>
        <LessonQuestion>{step.content.question}</LessonQuestion>
      </PlayerChoiceScenePrompt>

      <LessonChoiceOptions
        isChecked={Boolean(result)}
        isLocked={isLocked}
        onSelect={(optionId) => onAnswer(optionId ? { kind: "check", optionId } : null)}
        options={step.content.options}
        selectedId={selectedId}
      />

      <ExplainFirstButton />
    </PlayerChoiceScene>
  );
}
