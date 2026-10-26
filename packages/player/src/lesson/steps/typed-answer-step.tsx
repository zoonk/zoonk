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

/**
 * Writing can wait for tomorrow, in any lesson, when the learner is on the bus, can't use a keyboard
 * or would rather not type now: the rest of today's lessons leave it out too, until "Write again".
 * Language goals also keep a permanent preference in Plan settings.
 */
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

/**
 * A written answer: an explanation in the learner's own words, graded one key point at a time, or
 * a short exact answer (it has accepted wordings), which needs no "own words" eyebrow. A question
 * whose answer is a number (every accepted answer is one) takes it in a number field instead,
 * answered like a calculation, with no way to leave it out.
 *
 * At most two quiet ways out, each saying what it does: "Explain first" when the explanation is
 * still ahead (the question comes back after it), otherwise "I don't know yet" (a good answer
 * shows, no verdict); and "Can't write now" (no writing for the rest of today).
 */
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

      {/* The ways out, one set of quiet actions a touch target apart. */}
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
