"use client";

import { LessonVisual } from "@zoonk/learn/visual";
import { Button } from "@zoonk/ui/components/button";
import { HelpCircleIcon, PenLineIcon, PenOffIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { COLUMN_GHOST_ACTION_CLASS, InteractiveStepLayout } from "../../components/step-layouts";
import { LessonContext, LessonEyebrow, LessonQuestion } from "../_components/lesson-step-text";
import { ScreenSupport } from "../_components/screen-support";
import { splitQuestionData } from "../_utils/lesson-aside";
import { focusLessonAfterTurn } from "../_utils/lesson-focus";
import { isNumberAnswer } from "../_utils/number-answer";
import { ExplainFirstButton } from "../controls/explain-first-button";
import { useLessonPlayer } from "../lesson-player-context";
import { LessonAnswerField } from "./lesson-answer-field";
import { type LessonStepViewProps, type StepOf } from "./lesson-step-view-props";

function SkipWritingButton() {
  const t = useExtracted();
  const { actions } = useLessonPlayer();

  return (
    <Button
      className={COLUMN_GHOST_ACTION_CLASS}
      onClick={() => {
        actions.skipWriting();
        focusLessonAfterTurn();
      }}
      size="sm"
      variant="ghost"
    >
      <PenOffIcon aria-hidden="true" />
      {t("Can't write now")}
    </Button>
  );
}

export function TypedAnswerStepView({
  answer,
  isLocked,
  onAnswer,
  step,
}: LessonStepViewProps<StepOf<"typedAnswer">>) {
  const t = useExtracted();
  const text = answer?.kind === "typedAnswer" ? answer.text : "";
  const { actions, screen } = useLessonPlayer();
  const isNumber = isNumberAnswer(step.content.acceptedAnswers);
  const isExplanation = !isNumber && (step.content.acceptedAnswers ?? []).length === 0;
  const { data, question } = splitQuestionData(step.content.question);

  return (
    <InteractiveStepLayout>
      <div className="flex flex-col gap-3">
        {isExplanation && (
          <LessonEyebrow icon={<PenLineIcon aria-hidden="true" />}>
            {t("In your own words")}
          </LessonEyebrow>
        )}
        <ScreenSupport>
          <LessonContext>{step.content.context}</LessonContext>
          <LessonVisual visual={step.content.visual} />
          <LessonContext>{data ?? undefined}</LessonContext>
        </ScreenSupport>
        <LessonQuestion>{question}</LessonQuestion>
      </div>

      <LessonAnswerField
        autoFocusOnPointer
        isLocked={isLocked}
        isNumber={isNumber}
        label={step.content.question}
        onChange={(value) => onAnswer(value ? { kind: "typedAnswer", text: value } : null)}
        value={text}
      />

      <div className="flex flex-col gap-3.5 empty:hidden">
        <ExplainFirstButton />
        {!isLocked && !isNumber && (
          <>
            {!screen.canExplainFirst && (
              <Button
                className={COLUMN_GHOST_ACTION_CLASS}
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
            <SkipWritingButton />
          </>
        )}
      </div>
    </InteractiveStepLayout>
  );
}
