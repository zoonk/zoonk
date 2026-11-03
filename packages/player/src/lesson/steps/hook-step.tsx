"use client";

import { LessonVisual } from "@zoonk/learn/visual";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { HelpCircleIcon, SparklesIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PlayerChoiceScene, PlayerChoiceScenePrompt } from "../../components/player-choice-scene";
import { PlayerReadScene } from "../../components/player-read-scene";
import { COLUMN_GHOST_ACTION_CLASS } from "../../components/step-layouts";
import { LessonChoiceOptions } from "../_components/lesson-choice-options";
import {
  LessonStepPicture,
  useHasStepPicture,
  useIsRequiredPictureDrawing,
} from "../_components/lesson-pictures";
import {
  LessonBody,
  LessonContext,
  LessonEyebrow,
  LessonQuestion,
} from "../_components/lesson-step-text";
import { ScreenSupport } from "../_components/screen-support";
import { splitQuestionData } from "../_utils/lesson-aside";
import { focusLessonAfterTurn } from "../_utils/lesson-focus";
import { useLessonPlayer } from "../lesson-player-context";
import { type LessonStepViewProps, type StepOf } from "./lesson-step-view-props";

function HookGuess({
  answer,
  isLocked,
  onAnswer,
  result,
  step,
}: LessonStepViewProps<StepOf<"hook">>) {
  const t = useExtracted();
  const { actions } = useLessonPlayer();
  const isRequiredPictureDrawing = useIsRequiredPictureDrawing(step);

  if (step.content.variant !== "guess") {
    return null;
  }

  const selectedId = answer?.kind === "hook" ? answer.optionId : null;
  const { data, question } = splitQuestionData(step.content.question);
  const areOptionsLocked = isLocked || isRequiredPictureDrawing;

  return (
    <PlayerChoiceScene>
      <PlayerChoiceScenePrompt>
        <LessonEyebrow icon={<SparklesIcon aria-hidden="true" />}>
          {t({
            description:
              "Chip above the lesson's opening question, which the learner answers before being taught. Guesses are never scored.",
            message: "Just a guess, it doesn't count",
          })}
        </LessonEyebrow>
        <ScreenSupport>
          <LessonStepPicture asks priority step={step} />
          <LessonVisual visual={step.content.visual} />
          <LessonContext>{data ?? undefined}</LessonContext>
        </ScreenSupport>
        <LessonQuestion>{question}</LessonQuestion>
      </PlayerChoiceScenePrompt>

      <LessonChoiceOptions
        isChecked={Boolean(result)}
        isGuess
        isLocked={areOptionsLocked}
        onSelect={(optionId) => onAnswer(optionId ? { kind: "hook", optionId } : null)}
        options={step.content.options}
        selectedId={selectedId}
      />

      {!result && (
        <Button
          className={COLUMN_GHOST_ACTION_CLASS}
          disabled={areOptionsLocked}
          onClick={() => {
            actions.dontKnow(step.id);
            focusLessonAfterTurn();
          }}
          size="sm"
          variant="ghost"
        >
          <HelpCircleIcon aria-hidden="true" />
          {t("I don't know yet")}
        </Button>
      )}
    </PlayerChoiceScene>
  );
}

export function HookStepView(props: LessonStepViewProps<StepOf<"hook">>) {
  const { step } = props;
  const hasPicture = useHasStepPicture(step);

  if (step.content.variant === "guess") {
    return <HookGuess {...props} />;
  }

  return (
    <PlayerReadScene className={cn("gap-5 sm:gap-6", hasPicture && "max-sm:pt-0")}>
      <LessonBody>{step.content.text}</LessonBody>
      <LessonStepPicture className="order-first" hero priority step={step} />
      <LessonVisual visual={step.content.visual} />
    </PlayerReadScene>
  );
}
