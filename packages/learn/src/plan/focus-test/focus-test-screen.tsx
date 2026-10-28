"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import {
  GenerationTimelineDescription,
  GenerationTimelineTitle,
} from "@zoonk/ui/components/generation-timeline";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { type HelpLimit, HelpLimitNotice } from "../../_components/help-limit-notice";
import { AnswersSaveError } from "../../_components/save-error";
import { StepCard, StepDetail, StepHeader, StepTitle } from "../../_components/step-card";
import { TaskMeta } from "../../_components/task-meta";
import { useFormatDuration } from "../../_utils/time-format";
import { type LearnBuddy } from "../../buddies/use-buddy-name";
import { type GenerationRun } from "../../generation/generation-run";
import { GenerationWait } from "../../generation/generation-wait";
import { useLearnRoutes } from "../../learn-context";
import { LearnLink } from "../../learn-link";
import { type ChoiceQuestionView } from "../../questions/choice-question";
import {
  type ChoiceQuestionAnswer,
  ChoiceQuestionsRun,
} from "../../questions/choice-questions-run";
import { type MomentCeremony } from "../../session/moment-ceremony";
import { TaskFrame, TaskMainButton } from "../../shell/task-frame";
import { type FocusTestOutcome, FocusTestResult } from "./focus-test-result";

export type { FocusTestOutcome } from "./focus-test-result";

const SECONDS_PER_QUESTION = 30;

const SECONDS_PER_MINUTE = 60;

type FocusTestQuestion = ChoiceQuestionView & { area: string };

export type FocusTestView = {
  areas: string[];
  questions: FocusTestQuestion[];
  questionsPerArea: number;
  trueFalseLabels: TrueFalseLabels;
};

type FocusTestPreparing = {
  limit: HelpLimit | null;
  /** A POST, on the learner's tap. */
  onStart: () => void;
  run: GenerationRun | null;
  starting: boolean;
};

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
  const formatDuration = useFormatDuration();
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
      <StepCard>
        <StepHeader>
          <StepTitle>{t("Where should you focus?")}</StepTitle>
          <StepDetail>
            {t(
              "A few questions on each subject. The ones you need most come first and get more depth.",
            )}
          </StepDetail>
        </StepHeader>
        <TaskMeta
          facts={[
            t("{count, plural, one {# subject} other {# subjects}}", { count: test.areas.length }),
            t("{count, plural, one {# question} other {# questions}}", { count: questions }),
            t("About {time}", { time: formatDuration(minutes) }),
          ]}
        />
      </StepCard>
    </TaskFrame>
  );
}

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

function countTestQuestions(test: FocusTestView): number {
  return test.areas.length * test.questionsPerArea;
}

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

function FocusTestRun({
  buddy,
  closeHref,
  doneHref,
  onSubmit,
  onUndo,
  renderCeremony,
  test,
  writing,
}: {
  buddy?: LearnBuddy | null;
  closeHref: string;
  doneHref: string;
  onSubmit: (answers: ChoiceQuestionAnswer[]) => Promise<FocusTestOutcome | null>;
  onUndo: (changeId: string) => Promise<boolean>;
  renderCeremony?: MomentCeremony;
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
        buddy={buddy}
        closeHref={closeHref}
        doneHref={doneHref}
        onUndo={onUndo}
        outcome={outcome}
        renderCeremony={renderCeremony}
      />
    );
  }

  if (outcome === null && answers && !isPending) {
    return (
      <TaskFrame exitHref={closeHref}>
        <AnswersSaveError onRetry={() => submit(answers)} />
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

export function FocusTestScreen({
  buddy,
  closeHref,
  doneHref,
  onSubmit,
  onUndo,
  preparing,
  renderCeremony,
  started,
  test,
}: {
  buddy?: LearnBuddy | null;
  closeHref: string;
  doneHref: string;
  onSubmit: (answers: ChoiceQuestionAnswer[]) => Promise<FocusTestOutcome | null>;
  /** False when it didn't work. */
  onUndo: (changeId: string) => Promise<boolean>;
  /** Null when every question exists. */
  preparing: FocusTestPreparing | null;
  renderCeremony?: MomentCeremony;
  started: boolean;
  test: FocusTestView;
}) {
  const ready = test.questions.length > 0;
  const [tapped, setTapped] = useState(false);
  const [running, setRunning] = useState(false);

  // Once asked, the questions stay through to the result, though the page reads the test again.
  if (!running && ready && (started || tapped)) {
    setRunning(true);
  }

  if (preparing?.run && !ready && !running) {
    return <FocusTestWriting closeHref={closeHref} run={preparing.run} />;
  }

  if (running || (ready && (started || tapped))) {
    return (
      <FocusTestRun
        buddy={buddy}
        closeHref={closeHref}
        doneHref={doneHref}
        onSubmit={onSubmit}
        onUndo={onUndo}
        renderCeremony={renderCeremony}
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

export function isFocusTestComplete(test: FocusTestView): boolean {
  return test.questions.length >= countTestQuestions(test);
}
