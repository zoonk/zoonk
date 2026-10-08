"use client";

import { LessonVisual } from "@zoonk/learn/visual";
import { Button } from "@zoonk/ui/components/button";
import { PenLineIcon, PenOffIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useTransition } from "react";
import { InteractiveStepLayout } from "../../components/step-layouts";
import { LessonContext, LessonEyebrow, LessonQuestion } from "../_components/lesson-step-text";
import { isNumberAnswer } from "../_utils/number-answer";
import { ExplainFirstButton } from "../controls/explain-first-button";
import { useLessonPlayer, useLessonPlayerConfig } from "../lesson-player-context";
import { LessonAnswerField } from "./lesson-answer-field";
import { type LessonStepViewProps, type StepOf } from "./lesson-step-view-props";

/**
 * "Skip writing" in a language lesson: writing leaves the learner's plan (they can bring it back
 * in Plan) and this lesson goes on without its writing screens.
 */
function SkipWritingButton() {
  const t = useExtracted();
  const { adapters } = useLessonPlayerConfig();
  const { actions } = useLessonPlayer();
  const [isPending, startTransition] = useTransition();

  if (!adapters.skipLanguageActivity) {
    return null;
  }

  return (
    <Button
      className="w-fit self-center"
      disabled={isPending}
      onClick={() => startTransition(() => actions.skipActivity("writing"))}
      size="sm"
      variant="ghost"
    >
      <PenOffIcon aria-hidden="true" />
      {t("Skip writing")}
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
  const isNumber = isNumberAnswer(step.content.acceptedAnswers);

  return (
    <InteractiveStepLayout>
      <div className="flex flex-col gap-3">
        {!isNumber && (
          <LessonEyebrow icon={<PenLineIcon aria-hidden="true" />}>
            {t("In your own words")}
          </LessonEyebrow>
        )}
        <LessonContext>{step.content.context}</LessonContext>
        <LessonVisual visual={step.content.visual} />
        <LessonQuestion>{step.content.question}</LessonQuestion>
      </div>

      <LessonAnswerField
        isLocked={isLocked}
        isNumber={isNumber}
        label={step.content.question}
        onChange={(value) => onAnswer(value ? { kind: "typedAnswer", text: value } : null)}
        value={text}
      />

      <ExplainFirstButton />
      {!isLocked && <SkipWritingButton />}
    </InteractiveStepLayout>
  );
}
