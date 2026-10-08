"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import {
  GenerationTimelineDescription,
  GenerationTimelineTitle,
} from "@zoonk/ui/components/generation-timeline";
import { CircleHelpIcon, ClockIcon, CrosshairIcon, LayersIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { FactChip, FactChips } from "../../_components/fact-chips";
import { type HelpLimit, HelpLimitNotice } from "../../_components/help-limit-notice";
import { KindTile } from "../../_components/kind-tile";
import { StepCard, StepDetail, StepHeader, StepTitle } from "../../_components/step-card";
import { type GenerationRun } from "../../generation/generation-run";
import { GenerationWait } from "../../generation/generation-wait";
import { useLearnRoutes } from "../../learn-context";
import { LearnLink } from "../../learn-link";
import { type ChoiceQuestionView } from "../../questions/choice-question";
import {
  type ChoiceQuestionAnswer,
  ChoiceQuestionsRun,
} from "../../questions/choice-questions-run";
import { TaskFrame, TaskMainButton, TaskSaveError } from "../../shell/task-frame";
import { type FocusTestOutcome, FocusTestResult } from "./focus-test-result";

export type { FocusTestOutcome } from "./focus-test-result";

/** About how long one of the test's questions takes, reading included. */
const SECONDS_PER_QUESTION = 30;

const SECONDS_PER_MINUTE = 60;

/** A question of the test, with the area it asks about. */
type FocusTestQuestion = ChoiceQuestionView & { area: string };

export type FocusTestView = {
  areas: string[];
  /** The ones that exist: fewer than the test asks while some are still to be written. */
  questions: FocusTestQuestion[];
  questionsPerArea: number;
  trueFalseLabels: TrueFalseLabels;
};

/** How the host writes the test's questions, when it doesn't have them all yet. */
export type FocusTestPreparing = {
  /** The learner's small AI help doesn't cover writing them now. */
  limit: HelpLimit | null;
  /** Asks for the questions (a POST, on the learner's tap). */
  onStart: () => void;
  /** The run writing them, once asked for. */
  run: GenerationRun | null;
  starting: boolean;
};

/** The test before it starts: what it is, how long it takes, and its one action. */
function FocusTestIntro({
  closeHref,
  onStart,
  preparing,
  test,
}: {
  closeHref: string;
  onStart: () => void;
  preparing: FocusTestPreparing | null;
  test: FocusTestView;
}) {
  const t = useExtracted();
  const routes = useLearnRoutes();
  const questions = test.areas.length * test.questionsPerArea;
  const minutes = Math.max(1, Math.round((questions * SECONDS_PER_QUESTION) / SECONDS_PER_MINUTE));
  const limit = preparing?.limit ?? null;

  return (
    <TaskFrame
      closeOnEscape
      exitHref={closeHref}
      footer={
        limit ? (
          <HelpLimitNotice limit={limit} linkComponent={LearnLink} routes={routes} />
        ) : (
          <TaskMainButton busy={preparing?.starting ?? false} onClick={onStart}>
            {preparing?.starting ? t("Starting…") : t("Start the test")}
          </TaskMainButton>
        )
      }
    >
      <div className="flex flex-1 flex-col justify-center lg:flex-none">
        <StepCard>
          <KindTile icon={CrosshairIcon} kind="challenge" size="lg" />
          <StepHeader>
            <StepTitle>{t("Where should you focus?")}</StepTitle>
            <StepDetail>
              {t(
                "A few questions on each subject. The ones you need most come first and get more depth.",
              )}
            </StepDetail>
          </StepHeader>
          <FactChips className="justify-center">
            <FactChip>
              <LayersIcon aria-hidden="true" />
              {t("{count, plural, one {# subject} other {# subjects}}", {
                count: test.areas.length,
              })}
            </FactChip>
            <FactChip>
              <CircleHelpIcon aria-hidden="true" />
              {t("{count, plural, one {# question} other {# questions}}", { count: questions })}
            </FactChip>
            <FactChip>
              <ClockIcon aria-hidden="true" />
              {t("About {minutes, number} min", { minutes })}
            </FactChip>
          </FactChips>
        </StepCard>
      </div>
    </TaskFrame>
  );
}

/** The test's questions being written, under the task's header; it opens once they're ready. */
function FocusTestWriting({ closeHref, run }: { closeHref: string; run: GenerationRun }) {
  const t = useExtracted();

  return (
    <TaskFrame exitHref={closeHref}>
      <GenerationWait kind="focusTestQuestions" run={run}>
        <GenerationTimelineTitle>{t("Getting your test ready")}</GenerationTimelineTitle>
        <GenerationTimelineDescription>
          {t(
            "We're writing a few questions on each subject. The test opens here when they're ready.",
          )}
        </GenerationTimelineDescription>
      </GenerationWait>
    </TaskFrame>
  );
}

/** How many questions the test asks once every one is written. */
function countTestQuestions(test: FocusTestView): number {
  return test.areas.length * test.questionsPerArea;
}

/**
 * The questions as the learner meets them: the ones the run started with, then each one written
 * since, at the end, so a question never moves once it's in line.
 */
function useArrivingQuestions(questions: readonly FocusTestQuestion[]): FocusTestQuestion[] {
  const [inLine, setInLine] = useState<FocusTestQuestion[]>([...questions]);
  const [latest, setLatest] = useState(questions);

  if (questions !== latest) {
    const known = new Set(inLine.map((question) => question.itemId));
    setLatest(questions);
    setInLine([...inLine, ...questions.filter((question) => !known.has(question.itemId))]);
  }

  return inLine;
}

/**
 * In place of the next question while it's written: how the run writing it is going, or, once it
 * ended without some of them, that the answers given are enough to finish.
 */
function FocusTestWaiting({ run }: { run: GenerationRun }) {
  const t = useExtracted();
  const endedShort = run.status === "ready";

  return (
    <GenerationWait kind="focusTestQuestions" run={run}>
      {/* oxlint-disable-next-line jsx-a11y/heading-has-content -- An h2 under the test's header, with the title's text. */}
      <GenerationTimelineTitle render={<h2 />}>
        {endedShort
          ? t("Some questions couldn't be written")
          : t("Your next questions are on the way")}
      </GenerationTimelineTitle>
      <GenerationTimelineDescription>
        {endedShort
          ? t("Finish with the answers you gave: they still choose where your plan goes deeper.")
          : t("We're writing the rest of the test. It goes on here when they're ready.")}
      </GenerationTimelineDescription>
    </GenerationWait>
  );
}

/**
 * The questions, area by area, each under its area's name; then the result. While the run
 * writing the rest (`writing`) goes on, the ones that exist are asked first.
 */
function FocusTestRun({
  closeHref,
  doneHref,
  onSubmit,
  onUndo,
  test,
  writing,
}: {
  closeHref: string;
  doneHref: string;
  onSubmit: (answers: ChoiceQuestionAnswer[]) => Promise<FocusTestOutcome | null>;
  onUndo: (changeId: string) => Promise<boolean>;
  test: FocusTestView;
  writing: GenerationRun | null;
}) {
  const t = useExtracted();
  const [answers, setAnswers] = useState<ChoiceQuestionAnswer[] | null>(null);
  const [outcome, setOutcome] = useState<FocusTestOutcome | null | undefined>();
  const [isPending, startTransition] = useTransition();
  const questions = useArrivingQuestions(test.questions);
  const total = countTestQuestions(test);

  const upcoming =
    writing && questions.length < total
      ? {
          ended: writing.status === "failed" || writing.status === "ready",
          total,
          waiting: <FocusTestWaiting run={writing} />,
        }
      : null;

  const submit = (all: ChoiceQuestionAnswer[]) => {
    setAnswers(all);
    startTransition(async () => setOutcome(await onSubmit(all).catch(() => null)));
  };

  if (outcome) {
    return (
      <FocusTestResult
        closeHref={closeHref}
        doneHref={doneHref}
        onUndo={onUndo}
        outcome={outcome}
      />
    );
  }

  if (outcome === null && answers && !isPending) {
    return (
      <TaskFrame exitHref={closeHref}>
        <div className="flex flex-1 flex-col justify-center">
          <TaskSaveError onRetry={() => submit(answers)} />
        </div>
      </TaskFrame>
    );
  }

  return (
    <ChoiceQuestionsRun
      header={{ closeHref, screen: "focus-test", title: t("Focus test") }}
      hint={(question) => question.area}
      onFinish={submit}
      pending={isPending}
      questions={questions}
      trueFalseLabels={test.trueFalseLabels}
      upcoming={upcoming}
    />
  );
}

/**
 * The focus test, for a plan whose time doesn't cover everything in depth: a few questions on each
 * subject worth most, in the exam's format, whose answers choose where the depth goes. It opens on
 * what it is and its one action; questions the bank doesn't have yet are written on that tap (the
 * host follows the run and reads the page again as it ends) while the ones that exist are asked,
 * one per screen, area by area, the written ones after them. Only a test without any question
 * waits for the run first. The result says how each area went and the focus it set, with an undo.
 * `started` skips the opening once the learner already started it.
 */
export function FocusTestScreen({
  closeHref,
  doneHref,
  onSubmit,
  onUndo,
  preparing,
  started,
  test,
}: {
  closeHref: string;
  /** Where "See your plan" leads. */
  doneHref: string;
  onSubmit: (answers: ChoiceQuestionAnswer[]) => Promise<FocusTestOutcome | null>;
  /** Takes the focus the test set back; false when it didn't work. */
  onUndo: (changeId: string) => Promise<boolean>;
  /** Null when every question exists. */
  preparing: FocusTestPreparing | null;
  started: boolean;
  test: FocusTestView;
}) {
  const ready = test.questions.length > 0;
  const [tapped, setTapped] = useState(false);
  const [running, setRunning] = useState(false);

  // Once asked, the questions stay on screen through to the result: the page reading the test
  // again (the answers just saved are never asked again) doesn't take the learner back.
  if (!running && ready && (started || tapped)) {
    setRunning(true);
  }

  if (preparing?.run && !ready && !running) {
    return <FocusTestWriting closeHref={closeHref} run={preparing.run} />;
  }

  if (running || (ready && (started || tapped))) {
    return (
      <FocusTestRun
        closeHref={closeHref}
        doneHref={doneHref}
        onSubmit={onSubmit}
        onUndo={onUndo}
        test={test}
        writing={preparing?.run ?? null}
      />
    );
  }

  return (
    <FocusTestIntro
      closeHref={closeHref}
      onStart={() => (preparing ? preparing.onStart() : setTapped(true))}
      preparing={preparing}
      test={test}
    />
  );
}

/** Whether every question of the test exists, so it needs nothing written to start. */
export function isFocusTestComplete(test: FocusTestView): boolean {
  return test.questions.length >= countTestQuestions(test);
}
