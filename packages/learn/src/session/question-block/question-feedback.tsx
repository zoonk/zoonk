"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { formatMathAnswer } from "@zoonk/utils/math-answer";
import { CheckCircle2Icon, NotebookPenIcon, SparklesIcon, XCircleIcon } from "lucide-react";
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

/**
 * The grade after an answer: right or wrong, the right answer and why, and quiet notes when a mistake was saved or fixed. Fun flips it in like the
 * back of the paper; a wrong answer flips calmly.
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
  const answerText = useAnswerText(trueFalseLabels);

  const correct = feedback.isCorrect
    ? null
    : answerText({ answer: feedback.correctAnswer, question });

  const Icon = feedback.isCorrect ? CheckCircle2Icon : XCircleIcon;

  return (
    <section
      aria-label={t("Answer feedback")}
      aria-live="polite"
      className={cn(
        "flex flex-col gap-2 rounded-2xl border p-4",
        feedback.isCorrect
          ? "border-success/40 bg-success/5"
          : "border-destructive/30 bg-destructive/5",
        "in-data-[mode=fun]:fun-paper in-data-[mode=fun]:border-transparent",
        feedback.isCorrect
          ? "in-data-[mode=fun]:animate-fun-flip"
          : "in-data-[mode=fun]:animate-fun-flip-calm",
      )}
    >
      <p
        className={cn(
          "flex items-center gap-2 font-semibold",
          feedback.isCorrect ? "text-success" : "text-destructive",
        )}
      >
        <Icon aria-hidden="true" className="size-5" />
        {feedback.isCorrect ? t("Correct!") : t("Not quite")}
      </p>

      {correct && <p className="text-sm">{t("Right answer: {answer}", { answer: correct })}</p>}

      {feedback.explanation && (
        <p className="text-muted-foreground text-sm leading-relaxed">{feedback.explanation}</p>
      )}

      {!feedback.isCorrect && <WorkedSteps steps={feedback.workedSteps} />}

      {question.citation && (
        <ItemCitationNote
          citation={question.citation}
          className="bg-background/60 in-data-[mode=fun]:bg-fun-soft rounded-xl px-3 py-2"
        />
      )}

      {feedback.mistakeFixed && (
        <p className="text-success flex items-start gap-2 text-sm">
          <LineMarker>
            <SparklesIcon aria-hidden="true" className="size-4" />
          </LineMarker>
          {t("Mistake fixed. It leaves your notebook.")}
        </p>
      )}

      {children}

      {feedback.savedToNotebook && (
        <p className="text-muted-foreground flex items-start gap-2 text-sm">
          <LineMarker>
            <NotebookPenIcon aria-hidden="true" className="size-4" />
          </LineMarker>
          {t("Saved to your mistakes, so it comes back.")}
        </p>
      )}
    </section>
  );
}
