"use client";

import { type ActivityAnswer } from "@zoonk/core/library/activities/answer-schema";
import { type getActivityNumericDisplay } from "@zoonk/core/library/activities/answers";
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
type NumericDisplay = ReturnType<typeof getActivityNumericDisplay>;

/** How a numeric check's numbers are written, with the digits its answer (and the learner's) needs. */
function exactAnswerFormat({ check, value }: { check: NumericCheck; value?: number }) {
  return {
    maximumFractionDigits: Math.max(
      exactFractionDigitsFor({ expected: check.answer, tolerance: check.tolerance, value }),
      countDecimalPlaces(value ?? 0),
    ),
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
  display,
  isCorrect,
  showsNumbers,
}: {
  answer: ActivityAnswer | null;
  check: NumericCheck;
  display: NumericDisplay;
  isCorrect: boolean;
  showsNumbers: boolean;
}) {
  const format = useFormatNumber();

  const value = answer?.kind === "numeric" ? answer.value : undefined;

  const rightAnswer = format(
    display?.value ?? check.answer,
    !display || display.places === null
      ? exactAnswerFormat({ check, value })
      : { maximumFractionDigits: display.places, unit: check.unit },
  );

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
  display,
  isCorrect,
  showsNumbers = true,
}: {
  answer: ActivityAnswer | null;
  content: ActivityStepContent;
  display: NumericDisplay;
  isCorrect: boolean;
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
          display={display}
          isCorrect={isCorrect}
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
