"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { formatMathAnswer } from "@zoonk/utils/math-answer";
import { ChevronsUpIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type DiffLine, DiffLines } from "../../_components/diff-lines";
import {
  FeedbackExplanation,
  FeedbackNote,
  FeedbackPanel,
  FeedbackVerdict,
} from "../../_components/feedback-panel";
import { ItemCitationNote } from "../../_components/item-citation";
import { useAppLocale } from "../../_utils/locale";
import { ItemLine, ItemText } from "../../questions/item-text";
import { RightAnswerLine } from "../../questions/right-answer-line";
import { useTrueFalseLabels } from "../../questions/use-true-false-labels";
import {
  type StudyAnswerFeedback,
  type StudyQuestion,
  type StudyQuestionAnswer,
} from "../session-types";

/**
 * An answer as feedback shows it: picked options, pairs and numbers as item text with their
 * formulas, and a typed answer exactly as typed, since it's plain text (`__init__` keeps its
 * underscores).
 */
export function useAnswerLine(trueFalseLabels: TrueFalseLabels) {
  const locale = useAppLocale();
  const { answerLabel } = useTrueFalseLabels(trueFalseLabels);

  function itemText({
    answer,
    question,
  }: {
    answer: Exclude<StudyQuestionAnswer, { text: string }>;
    question: Pick<StudyQuestion, "options" | "left" | "right" | "unit">;
  }): string | null {
    if ("selectedIndex" in answer) {
      const option = question.options?.[answer.selectedIndex];
      return option ?? null;
    }

    if ("selectedIndexes" in answer || "order" in answer) {
      const [picks, separator] =
        "order" in answer ? [answer.order, " → "] : [answer.selectedIndexes, "; "];

      return picks.map((index) => question.options?.[index] ?? "").join(separator);
    }

    if ("isTrue" in answer) {
      return answerLabel(answer.isTrue);
    }

    if ("matches" in answer) {
      return (question.left ?? [])
        .map((entry, index) => {
          const match = question.right?.[answer.matches[index] ?? -1] ?? "";
          return `${entry} → ${match}`;
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
  }

  return function answerLine({
    answer,
    question,
  }: {
    answer: StudyQuestionAnswer | null;
    question: Pick<StudyQuestion, "options" | "left" | "right" | "unit">;
  }): React.ReactNode {
    if (!answer) {
      return null;
    }

    if ("text" in answer) {
      return answer.text || null;
    }

    const text = itemText({ answer, question });
    return text === null ? null : <ItemLine text={text} />;
  };
}

export function WorkedSteps({ steps }: { steps: string[] }) {
  const t = useExtracted();

  if (steps.length === 0) {
    return null;
  }

  const lines = steps.map((step, index): DiffLine => ({
    kind: index === steps.length - 1 ? "added" : "context",
    text: <ItemLine text={step} />,
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
}): React.ReactNode {
  const answerLine = useAnswerLine(trueFalseLabels);

  if (
    feedback.isCorrect ||
    question.format === "multipleChoice" ||
    question.format === "trueFalse"
  ) {
    return null;
  }

  return answerLine({ answer: feedback.correctAnswer, question });
}

function MistakeNote({ feedback }: { feedback: StudyAnswerFeedback }) {
  const t = useExtracted();

  if (feedback.mistakeFixed) {
    return <FeedbackNote>{t("Mistake fixed. It leaves your notebook.")}</FeedbackNote>;
  }

  if (!feedback.savedToNotebook) {
    return null;
  }

  return (
    <FeedbackNote>
      {t({
        description: '"Your mistakes" is the learner\'s Mistakes notebook.',
        message: "Saved to your mistakes",
      })}
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
  feedback,
  question,
  timedOut,
  trueFalseLabels,
}: {
  answer: StudyQuestionAnswer;
  children?: React.ReactNode;
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

      {correct && <RightAnswerLine answer={correct} />}

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
      <MistakeNote feedback={feedback} />
    </FeedbackPanel>
  );
}
