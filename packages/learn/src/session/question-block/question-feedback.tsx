"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { formatMathAnswer } from "@zoonk/utils/math-answer";
import {
  CheckCircle2Icon,
  MinusCircleIcon,
  NotebookPenIcon,
  SparklesIcon,
  XCircleIcon,
  ZapIcon,
} from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { ItemCitationNote } from "../../_components/item-citation";
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
      return question.options?.[answer.selectedIndex] ?? null;
    }

    if ("isTrue" in answer) {
      return answerLabel(answer.isTrue);
    }

    if ("matches" in answer) {
      return (question.left ?? [])
        .map((entry, index) => `${entry} → ${question.right?.[answer.matches[index] ?? -1] ?? ""}`)
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

/** How to solve a math problem, step by step with the numbers the learner saw. */
export function WorkedSteps({ steps }: { steps: string[] }) {
  const t = useExtracted();

  if (steps.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="font-medium">{t("How to solve it")}</p>
      <ol className="text-muted-foreground list-decimal space-y-0.5 pl-5 leading-relaxed">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  );
}

/** Hyperdrive in its quietest form: a right answer that makes a streak of three or more says so. */
const SHOWN_STREAK = 3;

/**
 * The right answer in words, only where the question doesn't mark it: choice questions light the
 * right option, other formats say it here.
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

  if (feedback.isCorrect || question.format === "multipleChoice") {
    return null;
  }

  return answerText({ answer: feedback.correctAnswer, question });
}

/** One quiet note under the grade: the mistake was fixed, or saved to come back. */
function MistakeNote({ feedback }: { feedback: StudyAnswerFeedback }) {
  const t = useExtracted();

  if (feedback.mistakeFixed) {
    return (
      <p className="text-success flex items-start gap-2 text-sm">
        <LineMarker>
          <SparklesIcon aria-hidden="true" className="size-4" />
        </LineMarker>
        {t("Mistake fixed. It leaves your notebook.")}
      </p>
    );
  }

  if (!feedback.savedToNotebook) {
    return null;
  }

  return (
    <p className="text-muted-foreground flex items-start gap-2 text-sm">
      <LineMarker>
        <NotebookPenIcon aria-hidden="true" className="size-4" />
      </LineMarker>
      {t("Saved to your mistakes · it comes back tomorrow")}
    </p>
  );
}

/** Right, wrong, or left blank where a wrong answer costs a point: blank is neither, never red. */
function useGrade(feedback: StudyAnswerFeedback) {
  const t = useExtracted();

  if (feedback.isCorrect) {
    return {
      Icon: CheckCircle2Icon,
      label: t("Correct!"),
      surface: "border-success/40 bg-success/5",
      text: "text-success",
    };
  }

  if (feedback.blank) {
    return {
      Icon: MinusCircleIcon,
      label: t("Left blank"),
      surface: "border-border bg-muted/40",
      text: "text-foreground",
    };
  }

  return {
    Icon: XCircleIcon,
    label: t("Not quite"),
    surface: "border-destructive/30 bg-destructive/5",
    text: "text-destructive",
  };
}

/**
 * The grade after an answer: right, wrong or left blank (with the streak once it's three or more),
 * why, the right answer where the question doesn't show it, and one quiet note when a mistake was
 * saved or fixed.
 */
export function QuestionFeedback({
  children,
  feedback,
  question,
  trueFalseLabels,
}: {
  /** Notes a mistake's drill adds after the grade, such as the trap it set. */
  children?: React.ReactNode;
  feedback: StudyAnswerFeedback;
  question: StudyQuestion;
  trueFalseLabels: TrueFalseLabels;
}) {
  const t = useExtracted();
  const correct = useCorrectAnswerLine({ feedback, question, trueFalseLabels });
  const streak = feedback.isCorrect ? feedback.hyperdrive.streak : 0;
  const { Icon, label, surface, text } = useGrade(feedback);

  return (
    <section
      aria-label={t("Answer feedback")}
      aria-live="polite"
      className={cn("flex flex-col gap-2 rounded-2xl border p-4", surface)}
    >
      <p className="flex items-center justify-between gap-3">
        <span className={cn("flex items-center gap-2 font-semibold", text)}>
          <Icon aria-hidden="true" className="size-5" />
          {label}
        </span>

        {streak >= SHOWN_STREAK && (
          <span className="text-muted-foreground flex items-center gap-1 text-xs font-medium tabular-nums">
            <ZapIcon aria-hidden="true" className="size-3.5" />
            {t("{count} right in a row", { count: String(streak) })}
          </span>
        )}
      </p>

      {correct && <p className="text-sm">{t("Right answer: {answer}", { answer: correct })}</p>}

      {feedback.explanation && (
        <p className="text-muted-foreground text-sm leading-relaxed">{feedback.explanation}</p>
      )}

      {!feedback.isCorrect && <WorkedSteps steps={feedback.workedSteps} />}

      {question.citation && (
        <ItemCitationNote
          citation={question.citation}
          className="bg-background/60 rounded-xl px-3 py-2"
        />
      )}

      {children}
      <MistakeNote feedback={feedback} />
    </section>
  );
}
