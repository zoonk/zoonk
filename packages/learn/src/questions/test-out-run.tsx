"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { Progress } from "@zoonk/ui/components/progress";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { useExtracted, useLocale } from "next-intl";
import { useState, useTransition } from "react";
import { LearnLink } from "../learn-link";
import { type ChoiceAnswer, ChoiceQuestion, type ChoiceQuestionView } from "./choice-question";

const PERCENT = 100;

type TestOutAnswer = { answer: ChoiceAnswer; durationMs: number; itemId: string };

/** What the test-out decided, in the learner's terms. */
export type TestOutOutcome = {
  correct: number;
  passed: boolean;
  skippedLessons: number;
  total: number;
} | null;

function TestOutResult({ backHref, outcome }: { backHref: string; outcome: TestOutOutcome }) {
  const t = useExtracted();
  const backRef = useEnterClick<HTMLAnchorElement>();

  return (
    <div
      aria-live="polite"
      className="flex flex-col items-center gap-4 py-10 text-center"
      role="status"
    >
      <h1 className="text-2xl font-semibold">
        {outcome?.passed ? t("You already know this") : t("Not yet, and that's fine")}
      </h1>
      <p className="text-muted-foreground">
        {outcome?.passed
          ? t(
              "{lessons, plural, =0 {Your plan already skips it.} one {# lesson is off your plan. You can undo it from the plan.} other {# lessons are off your plan. You can undo it from the plan.}}",
              { lessons: outcome.skippedLessons },
            )
          : t(
              "The chapter stays in your plan, and today's answers help it start at the right level.",
            )}
      </p>
      {outcome && (
        <p className="text-muted-foreground text-sm">
          {t("{correct, number} of {total, number} right", {
            correct: outcome.correct,
            total: outcome.total,
          })}
        </p>
      )}
      <LearnLink className={buttonVariants()} href={backHref} ref={backRef}>
        {t("Back to the plan")}
      </LearnLink>
    </div>
  );
}

/**
 * A chapter test-out: one question per screen, no feedback until the end, and "I don't know yet"
 * always allowed. Passing takes the chapter's lessons off the plan with an undo.
 */
export function TestOutRun({
  backHref,
  chapterTitle,
  onSubmit,
  passMark,
  questions,
  trueFalseLabels,
}: {
  backHref: string;
  chapterTitle: string;
  onSubmit: (answers: TestOutAnswer[]) => Promise<TestOutOutcome>;
  passMark: number;
  questions: ChoiceQuestionView[];
  /** The words the goal's true-or-false questions are answered with, by its exam. */
  trueFalseLabels: TrueFalseLabels;
}) {
  const t = useExtracted();
  const locale = useLocale();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<TestOutAnswer[]>([]);
  const [selected, setSelected] = useState<ChoiceAnswer | null>(null);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [outcome, setOutcome] = useState<TestOutOutcome | undefined>();
  const [isPending, startTransition] = useTransition();
  const question = questions[index];
  const isRunning = outcome === undefined && question !== undefined;

  const answer = (choice: ChoiceAnswer) => {
    if (!question) {
      return;
    }

    const next = [
      ...answers,
      { answer: choice, durationMs: Date.now() - startedAt, itemId: question.itemId },
    ];

    if (index + 1 < questions.length) {
      setAnswers(next);
      setIndex(index + 1);
      setSelected(null);
      setStartedAt(Date.now());
      return;
    }

    startTransition(async () => setOutcome(await onSubmit(next)));
  };

  const nextRef = useEnterClick<HTMLButtonElement>({
    enabled: isRunning && selected !== null && !isPending,
  });

  if (outcome !== undefined) {
    return <TestOutResult backHref={backHref} outcome={outcome} />;
  }

  if (!question) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-muted-foreground text-sm">
          {t("Test out: {chapter}", { chapter: chapterTitle })}
        </h1>
        <p className="text-muted-foreground text-xs">
          {t("{passMark, number}% right skips the chapter. No feedback until the end.", {
            passMark: Math.round(passMark * PERCENT),
          })}
        </p>
        <Progress
          locale={locale}
          aria-label={t("Question {current, number} of {total, number}", {
            current: index + 1,
            total: questions.length,
          })}
          className="**:data-[slot=progress-track]:h-1.5"
          value={(index / questions.length) * PERCENT}
        />
      </header>

      <ChoiceQuestion
        onSelect={setSelected}
        question={question}
        selected={selected}
        trueFalseLabels={trueFalseLabels}
      />

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <Button
          disabled={!selected || isPending}
          onClick={() => selected && answer(selected)}
          ref={nextRef}
          size="lg"
        >
          {index + 1 < questions.length ? t("Next") : t("Finish")}
        </Button>
        <Button
          disabled={isPending}
          onClick={() => answer({ dontKnow: true })}
          size="lg"
          variant="ghost"
        >
          {t("I don't know yet")}
        </Button>
      </div>
    </div>
  );
}
