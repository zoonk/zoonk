"use client";

import { LessonVisual } from "@zoonk/learn/visual";
import { Button } from "@zoonk/ui/components/button";
import { PenLineIcon, PenOffIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { InteractiveStepLayout } from "../../components/step-layouts";
import { LessonContext, LessonEyebrow, LessonQuestion } from "../_components/lesson-step-text";
import { ScreenSupport } from "../_components/screen-support";
import { splitQuestionData } from "../_utils/lesson-aside";
import { focusLessonAfterTurn } from "../_utils/lesson-focus";
import { isNumberAnswer } from "../_utils/number-answer";
import { ExplainFirstButton } from "../controls/explain-first-button";
import { useLessonPlayer, useLessonPlayerConfig } from "../lesson-player-context";
import { LessonAnswerField } from "./lesson-answer-field";
import { type LessonStepViewProps, type StepOf } from "./lesson-step-view-props";

/**
 * Writing can wait for the next lesson when the learner is on the bus or can't use a keyboard.
 * The permanent preference stays in Plan settings.
 */
function SkipWritingButton() {
  const t = useExtracted();
  const { lesson } = useLessonPlayerConfig();
  const { actions } = useLessonPlayer();

  if (!lesson.targetLanguage) {
    return null;
  }

  return (
    <Button
      className="w-fit"
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

/**
 * "Explain it in your words": a written answer graded one key point at a time. A question whose
 * answer is a number (every accepted answer is one) takes it in a number field instead.
 */
export function TypedAnswerStepView({
  answer,
  isLocked,
  onAnswer,
  step,
}: LessonStepViewProps<StepOf<"typedAnswer">>) {
  const t = useExtracted();
  const text = answer?.kind === "typedAnswer" ? answer.text : "";
  const { actions } = useLessonPlayer();
  const isNumber = isNumberAnswer(step.content.acceptedAnswers);
  const { data, question } = splitQuestionData(step.content.question);

  return (
    <InteractiveStepLayout>
      <div className="flex flex-col gap-3">
        {!isNumber && (
          <LessonEyebrow icon={<PenLineIcon aria-hidden="true" />}>
            {t("In your own words")}
          </LessonEyebrow>
        )}
        <ScreenSupport step={step}>
          <LessonContext>{step.content.context}</LessonContext>
          <LessonVisual visual={step.content.visual} />
          <LessonContext>{data ?? undefined}</LessonContext>
        </ScreenSupport>
        <LessonQuestion>{question}</LessonQuestion>
      </div>

      <LessonAnswerField
        isLocked={isLocked}
        isNumber={isNumber}
        label={step.content.question}
        onChange={(value) => onAnswer(value ? { kind: "typedAnswer", text: value } : null)}
        value={text}
      />

      <ExplainFirstButton />
      {!isLocked && !isNumber && (
        <Button
          className="w-fit"
          onClick={() => {
            actions.skipWriting(step.id);
            focusLessonAfterTurn();
          }}
          size="sm"
          variant="ghost"
        >
          {t("I don't know yet")}
        </Button>
      )}
      {!isLocked && <SkipWritingButton />}
    </InteractiveStepLayout>
  );
}
