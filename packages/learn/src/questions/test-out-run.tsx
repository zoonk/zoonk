"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { CheckIcon, ListChecksIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { FactChip, FactChips } from "../_components/fact-chips";
import { KindTile } from "../_components/kind-tile";
import { StepCard, StepDetail, StepHeader, StepTitle } from "../_components/step-card";
import { Steps } from "../_components/steps";
import { TaskMainLink } from "../shell/task-frame";
import { type ChoiceQuestionView } from "./choice-question";
import { type ChoiceQuestionAnswer, ChoiceQuestionsRun } from "./choice-questions-run";
import { UndoButton } from "./undo-button";

export type { ChoiceQuestionView } from "./choice-question";

const PERCENT = 100;

/** What the test-out decided, in the learner's terms. */
export type TestOutOutcome = {
  /** The plan change that skipped the lessons, for its undo; null when nothing was skipped. */
  changeId: string | null;
  correct: number;
  passed: boolean;
  skippedLessons: number;
  total: number;
} | null;

/** Passed: a check that lands. Not yet: the chapter's lessons, still on the plan. */
function ResultMark({ passed }: { passed: boolean }) {
  if (!passed) {
    return <KindTile kind="lesson" size="lg" />;
  }

  return (
    <span className="bg-success/15 text-success motion-safe:animate-badge-land flex size-16 items-center justify-center rounded-2xl">
      <CheckIcon aria-hidden="true" className="size-8" strokeWidth={2.5} />
    </span>
  );
}

function useResultDetail({ outcome, undone }: { outcome: TestOutOutcome; undone: boolean }) {
  const t = useExtracted();

  if (!outcome?.passed) {
    return t(
      "The chapter stays in your plan, and today's answers help it start at the right level.",
    );
  }

  if (undone) {
    return t("The lessons are back in your plan.");
  }

  return t(
    "{lessons, plural, =0 {Your plan already skips it.} one {# lesson is off your plan.} other {# lessons are off your plan.}}",
    { lessons: outcome.skippedLessons },
  );
}

function ResultStep({ outcome, undone }: { outcome: TestOutOutcome; undone: boolean }) {
  const t = useExtracted();
  const passed = Boolean(outcome?.passed);
  const detail = useResultDetail({ outcome, undone });

  return (
    <StepCard aria-live="polite" role="status">
      <ResultMark passed={passed} />
      <StepHeader>
        <StepTitle>{passed ? t("You already know this") : t("Not yet, and that's fine")}</StepTitle>
        <StepDetail>{detail}</StepDetail>
      </StepHeader>

      {outcome && (
        <FactChips className="justify-center">
          <FactChip>
            <ListChecksIcon aria-hidden="true" />
            {t("{correct, number} of {total, number} right", {
              correct: outcome.correct,
              total: outcome.total,
            })}
          </FactChip>
        </FactChips>
      )}
    </StepCard>
  );
}

/**
 * What the test-out decided, as one step, then back to the chapter. Lessons it took off the plan
 * come back with one tap here, as on the plan change it made.
 */
function TestOutResult({
  closeHref,
  onUndo,
  outcome,
}: {
  closeHref: string;
  onUndo: (changeId: string) => Promise<boolean>;
  outcome: TestOutOutcome;
}) {
  const t = useExtracted();
  const [undo, setUndo] = useState<"done" | "failed" | null>(null);
  const [isPending, startTransition] = useTransition();
  const changeId = outcome?.changeId ?? null;

  const runUndo = () => {
    if (!changeId) {
      return;
    }

    startTransition(async () => {
      const done = await onUndo(changeId).catch(() => false);
      setUndo(done ? "done" : "failed");
    });
  };

  return (
    <Steps
      exitHref={closeHref}
      finalAction={<TaskMainLink href={closeHref}>{t("Continue")}</TaskMainLink>}
      finalOptions={
        changeId && undo !== "done" ? (
          <UndoButton failed={undo === "failed"} onUndo={runUndo} pending={isPending} />
        ) : null
      }
      items={[{ content: <ResultStep outcome={outcome} undone={undo === "done"} />, id: "result" }]}
    />
  );
}

/**
 * A chapter test-out, full screen like every task: one question per screen, no feedback until the
 * end, and "I don't know yet" always allowed; each answer is kept on the device as it's given
 * (`draftKey`). Passing takes the chapter's lessons off the plan, with an undo on its result.
 * Closing goes back to the chapter.
 */
export function TestOutRun({
  chapterTitle,
  closeHref,
  draftKey,
  onSubmit,
  onUndo,
  passMark,
  questions,
  trueFalseLabels,
}: {
  chapterTitle: string;
  closeHref: string;
  /** Where the answers are kept on the device as they're given, so a reload goes on from there. */
  draftKey?: string;
  onSubmit: (answers: ChoiceQuestionAnswer[]) => Promise<TestOutOutcome>;
  /** Puts the lessons a passed test-out skipped back in the plan; false when it didn't work. */
  onUndo: (changeId: string) => Promise<boolean>;
  passMark: number;
  questions: ChoiceQuestionView[];
  /** The words the goal's true-or-false questions are answered with, by its exam. */
  trueFalseLabels: TrueFalseLabels;
}) {
  const t = useExtracted();
  const [outcome, setOutcome] = useState<TestOutOutcome | undefined>();
  const [isPending, startTransition] = useTransition();

  if (outcome !== undefined) {
    return <TestOutResult closeHref={closeHref} onUndo={onUndo} outcome={outcome} />;
  }

  return (
    <ChoiceQuestionsRun
      draftKey={draftKey}
      header={{
        closeHref,
        screen: "test-out",
        title: t("Test out: {chapter}", { chapter: chapterTitle }),
      }}
      hint={() =>
        t("{passMark, number}% right skips the chapter. No feedback until the end.", {
          passMark: Math.round(passMark * PERCENT),
        })
      }
      onFinish={(answers) => startTransition(async () => setOutcome(await onSubmit(answers)))}
      pending={isPending}
      questions={questions}
      trueFalseLabels={trueFalseLabels}
    />
  );
}
