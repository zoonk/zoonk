"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { BookOpenIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import {
  StepCard,
  StepDetail,
  StepHeader,
  StepRow,
  StepRows,
  StepTitle,
} from "../_components/step-card";
import { Steps } from "../_components/steps";
import { TaskMeta } from "../_components/task-meta";
import { type TaskFrameAside, TaskMainLink, TaskSaveError } from "../shell/task-frame";
import { clearAnswerDraft } from "./_utils/answer-draft";
import { type ChoiceQuestionView } from "./choice-question";
import { type ChoiceQuestionAnswer, ChoiceQuestionsRun } from "./choice-questions-run";
import { UndoButton } from "./undo-button";

export type { ChoiceQuestionView } from "./choice-question";

const PERCENT = 100;

/** What the test-out decided, in the learner's terms; null when it couldn't be graded. */
export type TestOutOutcome = {
  /** The plan change that skipped the lessons, for its undo; null when nothing was skipped. */
  changeId: string | null;
  correct: number;
  passed: boolean;
  skippedLessons: number;
  total: number;
} | null;

type GradedTestOut = NonNullable<TestOutOutcome>;

function useResultDetail({ outcome, undone }: { outcome: GradedTestOut; undone: boolean }) {
  const t = useExtracted();

  if (!outcome.passed) {
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

function ResultStep({ outcome, undone }: { outcome: GradedTestOut; undone: boolean }) {
  const t = useExtracted();
  const detail = useResultDetail({ outcome, undone });

  return (
    <StepCard aria-live="polite" role="status">
      <StepHeader>
        <StepTitle>
          {outcome.passed ? t("You already know this") : t("Not yet, and that's fine")}
        </StepTitle>
        <StepDetail>{detail}</StepDetail>
      </StepHeader>

      <TaskMeta
        facts={[
          t("{correct, number} of {total, number} right", {
            correct: outcome.correct,
            total: outcome.total,
          }),
        ]}
      />
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
  outcome: GradedTestOut;
}) {
  const t = useExtracted();
  const [undo, setUndo] = useState<"done" | "failed" | null>(null);
  const [isPending, startTransition] = useTransition();
  const { changeId } = outcome;

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

/** "80% right skips the chapter. No feedback until the end.", the test's one rule. */
function useTestOutRule(passMark: number): string {
  const t = useExtracted();

  return t("{passMark, number}% right skips the chapter. No feedback until the end.", {
    passMark: Math.round(passMark * PERCENT),
  });
}

/**
 * What helps beside the questions from `lg`: what a pass takes off the plan (the chapter, with the
 * lessons it has left when the plan knows them) and the test's one rule, which a phone reads above
 * each question instead.
 */
function useTestOutAside({
  chapterTitle,
  lessonsLeft,
  rule,
}: {
  chapterTitle: string;
  lessonsLeft: number | null;
  rule: string;
}): TaskFrameAside {
  const t = useExtracted();

  return {
    children: (
      <>
        <StepRows>
          <StepRow>
            <BookOpenIcon aria-hidden="true" />
            <span className="min-w-0 flex-1 font-medium text-pretty">{chapterTitle}</span>
            {lessonsLeft !== null && lessonsLeft > 0 && (
              <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
                {t("{count, plural, one {# lesson left} other {# lessons left}}", {
                  count: lessonsLeft,
                })}
              </span>
            )}
          </StepRow>
        </StepRows>

        <p className="text-muted-foreground text-[0.8125rem] leading-5 text-pretty">{rule}</p>
      </>
    ),
    label: t("What a pass skips"),
    title: t("What a pass skips"),
  };
}

/**
 * A chapter test-out, full screen like every task: one question per screen, no feedback until the
 * end, and "I don't know yet" always allowed; each answer is kept on the device as it's given
 * (`draftKey`). Its rule sits above each question on a phone, and beside them from `lg` with what a
 * pass skips (`lessonsLeft`). Passing takes the chapter's lessons off the plan, with an undo on its
 * result. Answers that couldn't be graded keep the last question on screen with Try again: a
 * failure is never shown as a result. Closing goes back to the chapter.
 */
export function TestOutRun({
  chapterTitle,
  closeHref,
  draftKey,
  lessonsLeft = null,
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
  /** The chapter's lessons still on the plan, which a pass skips; null when the plan doesn't say. */
  lessonsLeft?: number | null;
  onSubmit: (answers: ChoiceQuestionAnswer[]) => Promise<TestOutOutcome>;
  /** Puts the lessons a passed test-out skipped back in the plan; false when it didn't work. */
  onUndo: (changeId: string) => Promise<boolean>;
  passMark: number;
  questions: ChoiceQuestionView[];
  /** The words the goal's true-or-false questions are answered with, by its exam. */
  trueFalseLabels: TrueFalseLabels;
}) {
  const t = useExtracted();
  const rule = useTestOutRule(passMark);
  const aside = useTestOutAside({ chapterTitle, lessonsLeft, rule });
  const [outcome, setOutcome] = useState<GradedTestOut | null>(null);
  // The answers whose grading didn't go through, to send again.
  const [unsent, setUnsent] = useState<ChoiceQuestionAnswer[] | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (answers: ChoiceQuestionAnswer[]) =>
    startTransition(async () => {
      const graded = await onSubmit(answers).catch(() => null);

      // Graded answers are done with the device's draft; ones that didn't go through keep it, so
      // leaving and coming back still has them.
      if (graded && draftKey) {
        clearAnswerDraft(draftKey);
      }

      setUnsent(graded ? null : answers);
      setOutcome(graded);
    });

  if (outcome) {
    return <TestOutResult closeHref={closeHref} onUndo={onUndo} outcome={outcome} />;
  }

  return (
    <ChoiceQuestionsRun
      aside={aside}
      draftKey={draftKey}
      error={unsent && !isPending && <TaskSaveError onRetry={() => submit(unsent)} />}
      header={{
        closeHref,
        screen: "test-out",
        title: t("Test out: {chapter}", { chapter: chapterTitle }),
      }}
      hint={() => rule}
      onFinish={submit}
      pending={isPending}
      questions={questions}
      trueFalseLabels={trueFalseLabels}
    />
  );
}
