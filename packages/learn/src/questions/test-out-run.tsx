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

/**
 * What the test-out decided, in the learner's terms, with the tenth of Energy its answers reached
 * and the milestone it's celebrated with; null when it couldn't be graded.
 */
export type TestOutOutcome =
  | (ProgressCelebration & {
      /** The plan change that skipped the lessons, for its undo; null when nothing was skipped. */
      changeId: string | null;
      correct: number;
      passed: boolean;
      skippedLessons: number;
      total: number;
    })
  | null;

type GradedTestOut = NonNullable<TestOutOutcome>;

/**
 * A test the learner sent before, as it was recorded: what it decided, with its undo while the
 * skip can still be undone (`changeId`) and whether it was undone. It celebrates nothing again.
 */
export type TestOutRecord = Omit<GradedTestOut, keyof ProgressCelebration> & { undone: boolean };

/** The test's questions, its pass mark, and the words its true-or-false questions are answered with. */
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

  return t(
    "{lessons, plural, =0 {Your plan already skips it.} one {# lesson is off your plan.} other {# lessons are off your plan.}}",
    { lessons: outcome.skippedLessons },
  );
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

/**
 * What the test-out decided, as one step, then back to the chapter. Lessons it took off the plan
 * come back with one tap here, as on the plan change it made. A milestone it earned opens first,
 * on its own.
 */
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
  /** A recorded result whose skip was undone already. */
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

/** The test's questions, one per screen, with its rule above each on a phone and beside them from `lg`. */
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

/**
 * A chapter test-out, full screen like every task: one question per screen, no feedback until the
 * end, and "I don't know yet" always allowed; each answer is kept on the device as it's given
 * (`draftKey`). Its rule sits above each question on a phone, and beside them from `lg` with what a
 * pass skips (`lessonsLeft`). Passing takes the chapter's lessons off the plan, with an undo on its
 * result. Answers that couldn't be graded keep the last question on screen with Try again: a
 * failure is never shown as a result. A test sent before (`recorded`: a reload, Back, its link)
 * shows its result as it was, still, in the same place, so the result just reached stays on screen
 * whatever the page reads again. Closing goes back to the chapter.
 */
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
  /** The learner's buddy, glad about the Energy the answers reach. */
  buddy?: LearnBuddy | null;
  chapterTitle: string;
  closeHref: string;
  /** Where the answers are kept on the device as they're given, so a reload goes on from there. */
  draftKey?: string;
  /** The chapter's lessons still on the plan, which a pass skips; null when the plan doesn't say. */
  lessonsLeft?: number | null;
  /**
   * Grades the answers. `requestId` is the test's own id, kept with the answers (`draftKey`) from
   * its first send until it's graded: a retry, after a reload too, sends it again, so the test is
   * counted once.
   */
  onSubmit: (input: {
    answers: ChoiceQuestionAnswer[];
    requestId: string;
  }) => Promise<TestOutOutcome>;
  /** Puts the lessons a passed test-out skipped back in the plan; false when it didn't work. */
  onUndo: (changeId: string) => Promise<boolean>;
  /** A test the learner sent before, shown as it was recorded instead of the questions. */
  recorded?: TestOutRecord | null;
  /** The full-screen moment for a milestone not shown yet (new glasses, a belt from earlier). */
  renderCeremony?: MomentCeremony;
  /** The questions to answer; null when only a recorded result shows. */
  test: TestOutTest | null;
}) {
  const [outcome, setOutcome] = useState<GradedTestOut | null>(null);
  // The answers whose grading didn't go through, to send again.
  const [unsent, setUnsent] = useState<ChoiceQuestionAnswer[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const ownId = useMemo(() => crypto.randomUUID(), []);

  const submit = (answers: ChoiceQuestionAnswer[]) =>
    startTransition(async () => {
      const requestId = draftKey ? keepDraftRequestId({ fallback: ownId, key: draftKey }) : ownId;
      const graded = await onSubmit({ answers, requestId }).catch(() => null);

      // Graded answers are done with the device's draft and the test's id; ones that didn't go
      // through keep both, so leaving and coming back still has them and sends the same test.
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
