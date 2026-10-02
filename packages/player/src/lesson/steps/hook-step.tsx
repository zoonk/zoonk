"use client";

import { SparklesIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PlayerChoiceScene, PlayerChoiceScenePrompt } from "../../components/player-choice-scene";
import { PlayerReadScene } from "../../components/player-read-scene";
import { LessonChoiceOptions } from "../_components/lesson-choice-options";
import { LessonQuestionPicture, LessonStepImage } from "../_components/lesson-step-image";
import { LessonBody, LessonEyebrow, LessonQuestion } from "../_components/lesson-step-text";
import { type LessonStepViewProps, type StepOf } from "./lesson-step-view-props";

function HookGuess({
  answer,
  isLocked,
  onAnswer,
  result,
  step,
}: LessonStepViewProps<StepOf<"hook">>) {
  const t = useExtracted();

  if (step.content.variant !== "guess") {
    return null;
  }

  const selectedId = answer?.kind === "hook" ? answer.optionId : null;

  return (
    <PlayerChoiceScene>
      <PlayerChoiceScenePrompt>
        <LessonEyebrow icon={<SparklesIcon aria-hidden="true" />}>
          {t("Guess first · no points")}
        </LessonEyebrow>
        <LessonQuestionPicture image={step.image} priority request={step.content.image} />
        <LessonQuestion>{step.content.question}</LessonQuestion>
      </PlayerChoiceScenePrompt>

      <LessonChoiceOptions
        isChecked={Boolean(result)}
        isLocked={isLocked}
        onSelect={(optionId) => onAnswer(optionId ? { kind: "hook", optionId } : null)}
        options={step.content.options}
        selectedId={selectedId}
      />

      {!result && (
        <p className="text-muted-foreground text-sm">
          {t("Getting it wrong now helps you remember later.")}
        </p>
      )}
    </PlayerChoiceScene>
  );
}

/**
 * The first screen opens with the idea: a guess that never counts, or a surprising fact or real
 * situation to read.
 */
export function HookStepView(props: LessonStepViewProps<StepOf<"hook">>) {
  const { step } = props;

  if (step.content.variant === "guess") {
    return <HookGuess {...props} />;
  }

  return (
    <PlayerReadScene className="gap-5 sm:gap-6">
      {step.image && <LessonStepImage image={step.image} priority />}
      <LessonBody>{step.content.text}</LessonBody>
    </PlayerReadScene>
  );
}
