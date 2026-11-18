"use client";

import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";
import { type ActivityStepContent } from "@zoonk/core/library/activities/templates";
import { FeedbackExplanation, FeedbackPanel } from "@zoonk/learn/feedback-panel";
import { useFormatNumber } from "@zoonk/learn/format-number";
import { RightAnswerLine } from "@zoonk/learn/right-answer-line";
import { VerdictLabel } from "@zoonk/learn/verdict-label";
import { exactFractionDigitsFor } from "@zoonk/utils/localized-number";
import { countDecimalPlaces } from "@zoonk/utils/rounded-answer";
import { useExtracted } from "next-intl";
import { use } from "react";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import {
  HyperdriveStreak,
  LessonResultNote,
  OwnResultNotesContext,
} from "../../lesson/feedback/lesson-result-notes";

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
  places,
  showsNumbers,
}: {
  answer: ActivityAnswer | null;
  check: NumericCheck;
  isCorrect: boolean;
  places: number | null;
  showsNumbers: boolean;
}) {
  const format = useFormatNumber();

  const value = answer?.kind === "numeric" ? answer.value : undefined;
  const written = exactAnswerFormat({ check, value });

  const rightAnswer = format(check.answer, {
    ...written,
    maximumFractionDigits: Math.max(
      places ?? 0,
      written.maximumFractionDigits,
      countDecimalPlaces(value ?? 0),
    ),
  });

  return (
    <>
      {/* The learner's number is in the box right above, so only the right one is added. */}
      {showsNumbers && !isCorrect && (
        <RightAnswerLine answer={<span className="tabular-nums">{rightAnswer}</span>} />
      )}

      <FeedbackText>{check.explanation}</FeedbackText>
    </>
  );
}

export function ActivityFeedback({
  answer,
  content,
  isCorrect,
  places,
  showsNumbers = true,
}: {
  answer: ActivityAnswer | null;
  content: ActivityStepContent;
  isCorrect: boolean;
  places: number | null;
  /** False when the canvas already shows the learner's number beside the right one. */
  showsNumbers?: boolean;
}) {
  const t = useExtracted();
  const notes = use(OwnResultNotesContext);
  const { check } = content;
  const streak = notes?.hyperdriveStreak ?? null;

  return (
    // As far under the answers as a lesson question's feedback, which follows its step's `pb-6`.
    <FeedbackPanel aria-label={t("Answer feedback")} aria-live="polite" className="mt-2">
      <VerdictLabel
        end={streak === null ? undefined : <HyperdriveStreak count={streak} />}
        verdict={isCorrect ? "correct" : "incorrect"}
      />

      {check.kind === "choice" && <ChoiceFeedback answer={answer} check={check} />}

      {check.kind === "numeric" && (
        <NumericFeedback
          answer={answer}
          check={check}
          isCorrect={isCorrect}
          places={places}
          showsNumbers={showsNumbers}
        />
      )}

      {check.kind === "interaction" && <FeedbackText>{check.explanation}</FeedbackText>}

      {notes && (
        <LessonResultNote
          savePending={notes.savePending}
          savedMistake={notes.savedMistake}
          willReturn={notes.willReturn}
        />
      )}
    </FeedbackPanel>
  );
}
