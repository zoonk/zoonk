"use client";

import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";
import { type ActivityStepContent } from "@zoonk/core/library/activities/templates";
import {
  FeedbackAnswerLabel,
  FeedbackExplanation,
  FeedbackPanel,
} from "@zoonk/learn/feedback-panel";
import { useFormatNumber } from "@zoonk/learn/format-number";
import { RightAnswerLine } from "@zoonk/learn/right-answer-line";
import { VerdictLabel } from "@zoonk/learn/verdict-label";
import { exactFractionDigitsFor } from "@zoonk/utils/localized-number";
import { useExtracted } from "next-intl";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";

type ChoiceCheck = Extract<ActivityStepContent["check"], { kind: "choice" }>;
type NumericCheck = Extract<ActivityStepContent["check"], { kind: "numeric" }>;

/** How a numeric check's numbers are written, with the digits its answer (and the learner's) needs. */
export function exactAnswerFormat({ check, value }: { check: NumericCheck; value?: number }) {
  return {
    maximumFractionDigits: exactFractionDigitsFor({
      expected: check.answer,
      tolerance: check.tolerance,
      value,
    }),
    unit: check.unit,
  };
}

function FeedbackText({ children }: { children: string }) {
  return (
    <FeedbackExplanation>
      <LessonRichText text={children} />
    </FeedbackExplanation>
  );
}

function ChoiceFeedback({ answer, check }: { answer: ActivityAnswer | null; check: ChoiceCheck }) {
  const chosen = check.options.find(
    (option) => answer?.kind === "choice" && option.id === answer.optionId,
  );

  const correct = check.options.find((option) => option.isCorrect);

  return (
    <>
      {chosen && <FeedbackText>{chosen.reason}</FeedbackText>}

      {correct && !chosen?.isCorrect && (
        <>
          <RightAnswerLine answer={<LessonRichText text={correct.text} />} />

          <FeedbackText>{correct.reason}</FeedbackText>
        </>
      )}
    </>
  );
}

function NumericFeedback({
  answer,
  check,
  isCorrect,
}: {
  answer: ActivityAnswer | null;
  check: NumericCheck;
  isCorrect: boolean;
}) {
  const t = useExtracted();
  const format = useFormatNumber();

  const written = exactAnswerFormat({
    check,
    value: answer?.kind === "numeric" ? answer.value : undefined,
  });

  const exact = (value: number) => format(value, written);

  return (
    <>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {answer?.kind === "numeric" && (
          <FeedbackExplanation>
            <FeedbackAnswerLabel>{t("Your answer:")}</FeedbackAnswerLabel>{" "}
            <span className="font-mono font-medium tabular-nums">{exact(answer.value)}</span>
          </FeedbackExplanation>
        )}

        {!isCorrect && (
          <RightAnswerLine
            answer={<span className="font-mono tabular-nums">{exact(check.answer)}</span>}
          />
        )}
      </div>

      <FeedbackText>{check.explanation}</FeedbackText>
    </>
  );
}

export function ActivityFeedback({
  answer,
  content,
  isCorrect,
}: {
  answer: ActivityAnswer | null;
  content: ActivityStepContent;
  isCorrect: boolean;
}) {
  const t = useExtracted();
  const { check } = content;

  return (
    <FeedbackPanel aria-label={t("Answer feedback")} aria-live="polite">
      <VerdictLabel verdict={isCorrect ? "correct" : "incorrect"} />

      {check.kind === "choice" && <ChoiceFeedback answer={answer} check={check} />}

      {check.kind === "numeric" && (
        <NumericFeedback answer={answer} check={check} isCorrect={isCorrect} />
      )}

      {check.kind === "interaction" && <FeedbackText>{check.explanation}</FeedbackText>}
    </FeedbackPanel>
  );
}
