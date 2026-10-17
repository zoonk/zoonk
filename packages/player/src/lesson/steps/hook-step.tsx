"use client";

import { LessonVisual } from "@zoonk/learn/visual";
import { cn } from "@zoonk/ui/lib/utils";
import { SparklesIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PlayerChoiceScene, PlayerChoiceScenePrompt } from "../../components/player-choice-scene";
import { PlayerReadScene } from "../../components/player-read-scene";
import { LessonChoiceOptions } from "../_components/lesson-choice-options";
import {
  LessonStepPicture,
  useHasStepPicture,
  useIsPictureDrawing,
} from "../_components/lesson-pictures";
import {
  LessonBody,
  LessonContext,
  LessonEyebrow,
  LessonQuestion,
} from "../_components/lesson-step-text";
import { ScreenSupport } from "../_components/screen-support";
import { splitQuestionData } from "../_utils/lesson-aside";
import { type LessonStepViewProps, type StepOf } from "./lesson-step-view-props";

function HookGuess({
  answer,
  isLocked,
  onAnswer,
  result,
  step,
}: LessonStepViewProps<StepOf<"hook">>) {
  const t = useExtracted();
  const isPictureDrawing = useIsPictureDrawing(step);

  if (step.content.variant !== "guess") {
    return null;
  }

  const selectedId = answer?.kind === "hook" ? answer.optionId : null;
  const { data, question } = splitQuestionData(step.content.question);

  return (
    <PlayerChoiceScene>
      <PlayerChoiceScenePrompt>
        <LessonEyebrow icon={<SparklesIcon aria-hidden="true" />}>{t("Guess first")}</LessonEyebrow>
        <ScreenSupport step={step}>
          <LessonStepPicture asks priority step={step} />
          <LessonVisual visual={step.content.visual} />
          <LessonContext>{data ?? undefined}</LessonContext>
        </ScreenSupport>
        <LessonQuestion>{question}</LessonQuestion>
      </PlayerChoiceScenePrompt>

      <LessonChoiceOptions
        isChecked={Boolean(result)}
        isGuess
        isLocked={isLocked || isPictureDrawing}
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
  const hasPicture = useHasStepPicture(step);

  if (step.content.variant === "guess") {
    return <HookGuess {...props} />;
  }

  // The text comes first for screen readers and in the aside's place from `lg`; a phone still
  // leads with the picture, like a story.
  return (
    <PlayerReadScene className={cn("gap-5 sm:gap-6", hasPicture && "max-sm:pt-0")}>
      <LessonBody>{step.content.text}</LessonBody>
      <ScreenSupport className="max-lg:contents" step={step}>
        <LessonStepPicture className="max-lg:order-first" hero priority step={step} />
        <LessonVisual visual={step.content.visual} />
      </ScreenSupport>
    </PlayerReadScene>
  );
}
