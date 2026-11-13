"use client";

import { Eyebrow } from "@zoonk/learn/eyebrow";
import { useSpokenText } from "@zoonk/learn/rich-text/speech";
import { LessonVisual } from "@zoonk/learn/visual";
import { PenLineIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { InteractiveStepLayout } from "../../components/step-layouts";
import { LessonContext, LessonQuestion } from "../_components/lesson-step-text";
import { ScreenSupport } from "../_components/screen-support";
import { splitQuestionData } from "../_utils/lesson-aside";
import { isNumberAnswer } from "../_utils/number-answer";
import { ExplainFirstButton } from "../controls/explain-first-button";
import { LessonAnswerField } from "./lesson-answer-field";
import { type LessonStepViewProps, type StepOf } from "./lesson-step-view-props";

export function TypedAnswerStepView({
  answer,
  isLocked,
  onAnswer,
  step,
}: LessonStepViewProps<StepOf<"typedAnswer">>) {
  const t = useExtracted();
  const spoken = useSpokenText();
  const text = answer?.kind === "typedAnswer" ? answer.text : "";
  const isNumber = isNumberAnswer(step.content.acceptedAnswers);
  const isExplanation = !isNumber && (step.content.acceptedAnswers ?? []).length === 0;
  const { data, question } = splitQuestionData(step.content.question);

  return (
    <InteractiveStepLayout>
      <div className="flex flex-col gap-3">
        {isExplanation && (
          <Eyebrow icon={<PenLineIcon aria-hidden="true" />}>{t("In your own words")}</Eyebrow>
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
        label={spoken.blocks(question)}
        onChange={(value) => onAnswer(value ? { kind: "typedAnswer", text: value } : null)}
        value={text}
      />

      <ExplainFirstButton />
    </InteractiveStepLayout>
  );
}
