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

/**
 * The right answer in words, from the grade's answer shape: a math answer with its unit, a
 * statement's in the goal's exam's words.
 */
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

/**
 * How to solve a math problem, step by step with the numbers the learner saw, as a mono diff: the
 * steps as quiet lines and the result as the added line, so the eye lands on where they lead.
 */
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

/** Hyperdrive in its quietest form: a right answer that makes a streak of three or more says so. */
const SHOWN_STREAK = 3;

/**
 * The right answer in words, only where the question doesn't mark it: choice and true-or-false
 * questions mark the right option, other formats say it here.
 */
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

/**
 * The panel's last line when a mistake moved: fixed, or saved to come back, tomorrow unless
 * tomorrow is the exam.
 */
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
        ? t("Saved to your mistakes")
        : t("Saved to your mistakes · it comes back tomorrow")}
    </FeedbackNote>
  );
}

/**
 * The verdict's words and tone: right, wrong, left blank where a wrong answer costs a point (blank
 * is neither, never red), or the learner's own "I don't know yet" (`notSure`), never called "Not
 * quite". Mistake practice says its verdicts the same way.
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

  return { label: t("Not quite"), tone: "wrong" as const };
}

/** "3 right in a row", Hyperdrive's quiet mark beside a right answer's verdict. */
function StreakNote({ streak }: { streak: number }) {
  const t = useExtracted();

  return (
    <span className="flex items-center gap-1 font-mono">
      <ChevronsUpIcon aria-hidden="true" className="size-3.5" />
      {t("{count} right in a row", { count: String(streak) })}
    </span>
  );
}

/**
 * The grade after an answer, on the quiet feedback panel: right, wrong or left blank (with the
 * streak once it's three or more), the right answer where the question doesn't show it, why, how
 * to solve it, the passage it quotes, the drill's notes, and last one quiet line when a mistake
 * was saved or fixed.
 */
export function QuestionFeedback({
  answer,
  children,
  examTomorrow,
  feedback,
  question,
  timedOut,
  trueFalseLabels,
}: {
  /** What the learner sent: their own "I don't know yet" is said back to them. */
  answer: StudyQuestionAnswer;
  /** Notes a mistake's drill adds after the grade, such as the trap it set. */
  children?: React.ReactNode;
  /** The goal's exam is tomorrow: a saved mistake doesn't come back then. */
  examTomorrow: boolean;
  feedback: StudyAnswerFeedback;
  question: StudyQuestion;
  /** A drill's time ran out: its "I don't know yet" is the clock's, not the learner's. */
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
