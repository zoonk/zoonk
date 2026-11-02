"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { type ProgressCelebration } from "@zoonk/core/sessions/progress-celebration";
import { NOTHING_REACHED } from "@zoonk/core/sessions/reached";
import { CelebrationScope } from "@zoonk/ui/hooks/celebration";
import { BookOpenIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { AnswersSaveError } from "../_components/save-error";
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
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { DayMoment, StepWithDayMoment } from "../session/day-moment";
import { type MomentCeremony, getCeremonyMoment } from "../session/moment-ceremony";
import { type TaskFrameAside, TaskMainLink } from "../shell/task-frame";
import { clearAnswerDraft, keepDraftRequestId } from "./_utils/answer-draft";
import { type ChoiceQuestionView } from "./choice-question";
import { type ChoiceQuestionAnswer, ChoiceQuestionsRun } from "./choice-questions-run";
import { UndoButton } from "./undo-button";

const PERCENT = 100;

export type TestOutOutcome =
  | (ProgressCelebration & {
      /** For its undo; null when nothing was skipped. */
      changeId: string | null;
      correct: number;
      passed: boolean;
      skippedLessons: number;
      total: number;
    })
  | null;

type GradedTestOut = NonNullable<TestOutOutcome>;

export type TestOutRecord = Omit<GradedTestOut, keyof ProgressCelebration> & { undone: boolean };

export type TestOutTest = {
  passMark: number;
  questions: ChoiceQuestionView[];
  trueFalseLabels: TrueFalseLabels;
};

function useResultDetail({ outcome, undone }: { outcome: GradedTestOut; undone: boolean }) {
  const t = useExtracted();

  if (!outcome.passed) {
    return t("The chapter stays in your plan, and your answers help it start at the right level.");
  }

  if (undone) {
    return t("The lessons are back in your plan.");
  }

  return t({
    description: 'The learner passed this chapter\'s test. "It" is the chapter.',
    message:
      "{lessons, plural, =0 {Your plan already skips it.} one {# lesson is off your plan.} other {# lessons are off your plan.}}",
    values: { lessons: outcome.skippedLessons },
  });
}

function ResultStep({
  buddy,
  outcome,
  undone,
}: {
  buddy?: LearnBuddy | null;
  outcome: GradedTestOut;
  undone: boolean;
}) {
  const t = useExtracted();
  const detail = useResultDetail({ outcome, undone });

  return (
    <StepWithDayMoment
      dayMoment={
        <DayMoment
          buddy={buddy}
          ceremony={outcome.ceremony}
          missionMoment={null}
          reached={outcome.reached}
        />
      }
    >
      <StepCard aria-live="polite" role="status">
        <StepHeader>
          <StepTitle>
            {outcome.passed ? t("You already know this") : t("Not yet, and that's fine")}
          </StepTitle>
          <StepDetail>{detail}</StepDetail>
        </StepHeader>

        <TaskMeta
          facts={[
            t(
              "{correct, plural, =0 {# of {total, number} right} one {# of {total, number} right} other {# of {total, number} right}}",
              { correct: outcome.correct, total: outcome.total },
            ),
          ]}
        />
      </StepCard>
    </StepWithDayMoment>
  );
}

function TestOutResult({
  buddy,
  closeHref,
  onUndo,
  outcome,
  renderCeremony,
  undone = false,
}: {
  buddy?: LearnBuddy | null;
  closeHref: string;
  onUndo: (changeId: string) => Promise<boolean>;
  outcome: GradedTestOut;
  renderCeremony?: MomentCeremony;
  undone?: boolean;
}) {
  const t = useExtracted();
  const [undo, setUndo] = useState<"done" | "failed" | null>(undone ? "done" : null);
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
      items={[
        {
          content: <ResultStep buddy={buddy} outcome={outcome} undone={undo === "done"} />,
          id: "result",
          moment: getCeremonyMoment({ milestone: outcome.ceremony, render: renderCeremony }),
        },
      ]}
    />
  );
}

function useTestOutRule(passMark: number): string {
  const t = useExtracted();

  return t("{passMark, number}% right skips the chapter. No feedback until the end.", {
    passMark: Math.round(passMark * PERCENT),
  });
}

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

function TestOutQuestions({
  chapterTitle,
  closeHref,
  draftKey,
  error,
  lessonsLeft,
  onFinish,
  pending,
  test,
}: {
  chapterTitle: string;
  closeHref: string;
  draftKey?: string;
  error: React.ReactNode;
  lessonsLeft: number | null;
  onFinish: (answers: ChoiceQuestionAnswer[]) => void;
  pending: boolean;
  test: TestOutTest;
}) {
  const t = useExtracted();
  const rule = useTestOutRule(test.passMark);
  const aside = useTestOutAside({ chapterTitle, lessonsLeft, rule });

  return (
    <ChoiceQuestionsRun
      aside={aside}
      draftKey={draftKey}
      error={error}
      header={{
        closeHref,
        screen: "test-out",
        title: t("Test out: {chapter}", { chapter: chapterTitle }),
      }}
      hint={() => rule}
      onFinish={onFinish}
      pending={pending}
      questions={test.questions}
      trueFalseLabels={test.trueFalseLabels}
    />
  );
}

export function TestOutRun({
  buddy,
  chapterTitle,
  closeHref,
  draftKey,
  lessonsLeft = null,
  onSubmit,
  onUndo,
  recorded = null,
  renderCeremony,
  test,
}: {
  buddy?: LearnBuddy | null;
  chapterTitle: string;
  closeHref: string;
  draftKey?: string;
  lessonsLeft?: number | null;
  /**
   * `requestId` is kept with the answers until graded, so a retry, even after a reload, counts the
   * test once.
   */
  onSubmit: (input: {
    answers: ChoiceQuestionAnswer[];
    requestId: string;
  }) => Promise<TestOutOutcome>;
  /** False when it didn't work. */
  onUndo: (changeId: string) => Promise<boolean>;
  recorded?: TestOutRecord | null;
  renderCeremony?: MomentCeremony;
  test: TestOutTest | null;
}) {
  const [outcome, setOutcome] = useState<GradedTestOut | null>(null);
  const [unsent, setUnsent] = useState<ChoiceQuestionAnswer[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const ownId = useMemo(() => crypto.randomUUID(), []);

  const submit = (answers: ChoiceQuestionAnswer[]) =>
    startTransition(async () => {
      const requestId = draftKey ? keepDraftRequestId({ fallback: ownId, key: draftKey }) : ownId;
      const graded = await onSubmit({ answers, requestId }).catch(() => null);

      // Only graded answers clear the draft and its id, so a failed send retries as the same test.
      if (graded && draftKey) {
        clearAnswerDraft(draftKey);
      }

      setUnsent(graded ? null : answers);
      setOutcome(graded);
    });

  const shown = outcome ?? (recorded && { ...recorded, ceremony: null, reached: NOTHING_REACHED });

  if (shown) {
    return (
      // A recorded result was celebrated when it was sent: opened again, it shows its end state.
      <CelebrationScope play={outcome !== null}>
        <TestOutResult
          buddy={buddy}
          closeHref={closeHref}
          onUndo={onUndo}
          outcome={shown}
          renderCeremony={renderCeremony}
          undone={!outcome && recorded?.undone}
        />
      </CelebrationScope>
    );
  }

  return (
    test && (
      <TestOutQuestions
        chapterTitle={chapterTitle}
        closeHref={closeHref}
        draftKey={draftKey}
        error={unsent && !isPending && <AnswersSaveError onRetry={() => submit(unsent)} />}
        lessonsLeft={lessonsLeft}
        onFinish={submit}
        pending={isPending}
        test={test}
      />
    )
  );
}
