"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { formatMathAnswer } from "@zoonk/utils/math-answer";
import { ChevronsUpIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { type DiffLine, DiffLines } from "../../_components/diff-lines";
import {
  FeedbackExplanation,
  FeedbackNote,
  FeedbackPanel,
  FeedbackVerdict,
} from "../../_components/feedback-panel";
import { ItemCitationNote } from "../../_components/item-citation";
import { toPlainItemLine } from "../../questions/_utils/item-text";
import { ItemText } from "../../questions/item-text";
import { useTrueFalseLabels } from "../../questions/use-true-false-labels";
import {
  type StudyAnswerFeedback,
  type StudyQuestion,
  type StudyQuestionAnswer,
} from "../session-types";

export function useAnswerText(trueFalseLabels: TrueFalseLabels) {
  const locale = useLocale();
  const { answerLabel } = useTrueFalseLabels(trueFalseLabels);

  return function answerText({
    answer,
    question,
  }: {
    answer: StudyQuestionAnswer | null;
    question: StudyQuestion;
  }): string | null {
    if (!answer) {
      return null;
    }

    if ("selectedIndex" in answer) {
      const option = question.options?.[answer.selectedIndex];
      return option === undefined ? null : toPlainItemLine(option);
    }

    if ("selectedIndexes" in answer || "order" in answer) {
      const [picks, separator] =
        "order" in answer ? [answer.order, " → "] : [answer.selectedIndexes, "; "];

      return picks.map((index) => toPlainItemLine(question.options?.[index] ?? "")).join(separator);
    }

    if ("text" in answer) {
      return answer.text;
    }

    if ("isTrue" in answer) {
      return answerLabel(answer.isTrue);
    }

    if ("matches" in answer) {
      return (question.left ?? [])
        .map((entry, index) => {
          const match = question.right?.[answer.matches[index] ?? -1] ?? "";
          return `${toPlainItemLine(entry)} → ${toPlainItemLine(match)}`;
        })
        .join("; ");
    }

    if ("number" in answer) {
      return formatMathAnswer({
        language: locale,
        unit: question.unit?.symbol ?? null,
        value: answer.number,
      });
    }

    return null;
  };
}

export function WorkedSteps({ steps }: { steps: string[] }) {
  const t = useExtracted();

  if (steps.length === 0) {
    return null;
  }

  const lines = steps.map((step, index): DiffLine => ({
    kind: index === steps.length - 1 ? "added" : "context",
    text: toPlainItemLine(step),
  }));

  return (
    <div className="flex flex-col">
      <p className="sr-only">{t("How to solve it")}</p>
      <DiffLines labels={{ added: t("Result"), removed: t("Your step") }} lines={lines} />
    </div>
  );
}

const SHOWN_STREAK = 3;

function useCorrectAnswerLine({
  feedback,
  question,
  trueFalseLabels,
}: {
  feedback: StudyAnswerFeedback;
  question: StudyQuestion;
  trueFalseLabels: TrueFalseLabels;
}): string | null {
  const answerText = useAnswerText(trueFalseLabels);

  if (
    feedback.isCorrect ||
    question.format === "multipleChoice" ||
    question.format === "trueFalse"
  ) {
    return null;
  }

  return answerText({ answer: feedback.correctAnswer, question });
}

function MistakeNote({
  examTomorrow,
  feedback,
}: {
  examTomorrow: boolean;
  feedback: StudyAnswerFeedback;
}) {
  const t = useExtracted();

  if (feedback.mistakeFixed) {
    return <FeedbackNote>{t("Mistake fixed. It leaves your notebook.")}</FeedbackNote>;
  }

  if (!feedback.savedToNotebook) {
    return null;
  }

  return (
    <FeedbackNote>
      {examTomorrow
        ? t({
            description: '"Your mistakes" is the learner\'s Mistakes notebook.',
            message: "Saved to your mistakes",
          })
        : t("Saved to your mistakes · it comes back tomorrow")}
    </FeedbackNote>
  );
}

/**
 * A blank is neither right nor wrong, never red, and the learner's own "I don't know yet" is never
 * called "Not quite".
 */
export function useVerdict({
  blank = false,
  isCorrect,
  notSure = false,
}: {
  blank?: boolean;
  isCorrect: boolean;
  notSure?: boolean;
}) {
  const t = useExtracted();

  if (isCorrect) {
    return { label: t("Correct!"), tone: "right" as const };
  }

  if (blank) {
    return { label: t("Left blank"), tone: "neutral" as const };
  }

  if (notSure) {
    return { label: t("I don't know yet"), tone: "neutral" as const };
  }

  return {
    label: t({ description: "Marks the learner's answer as wrong.", message: "Not quite" }),
    tone: "wrong" as const,
  };
}

function StreakNote({ streak }: { streak: number }) {
  const t = useExtracted();

  return (
    <span className="flex items-center gap-1 font-mono">
      <ChevronsUpIcon aria-hidden="true" className="size-3.5" />
      {t("{count} right in a row", { count: String(streak) })}
    </span>
  );
}

export function QuestionFeedback({
  answer,
  children,
  examTomorrow,
  feedback,
  question,
  timedOut,
  trueFalseLabels,
}: {
  answer: StudyQuestionAnswer;
  children?: React.ReactNode;
  examTomorrow: boolean;
  feedback: StudyAnswerFeedback;
  question: StudyQuestion;
  timedOut: boolean;
  trueFalseLabels: TrueFalseLabels;
}) {
  const t = useExtracted();
  const correct = useCorrectAnswerLine({ feedback, question, trueFalseLabels });
  const streak = feedback.isCorrect ? feedback.hyperdrive.streak : 0;
  const notSure = "dontKnow" in answer && !timedOut;
  const verdict = useVerdict({ ...feedback, notSure });

  return (
    <FeedbackPanel aria-label={t("Answer feedback")} aria-live="polite">
      <FeedbackVerdict
        end={streak >= SHOWN_STREAK ? <StreakNote streak={streak} /> : null}
        tone={verdict.tone}
      >
        {verdict.label}
      </FeedbackVerdict>

      {correct && (
        <FeedbackExplanation>
          {t("Right answer: {answer}", { answer: correct })}
        </FeedbackExplanation>
      )}

      {feedback.explanation && (
        <FeedbackExplanation>
          <ItemText text={feedback.explanation} />
        </FeedbackExplanation>
      )}

      {!feedback.isCorrect && <WorkedSteps steps={feedback.workedSteps} />}

      {question.citation && (
        <ItemCitationNote citation={question.citation} className="text-muted-foreground text-xs" />
      )}

      {children}
      <MistakeNote examTomorrow={examTomorrow} feedback={feedback} />
    </FeedbackPanel>
  );
}
