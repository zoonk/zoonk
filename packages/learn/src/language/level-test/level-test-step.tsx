"use client";

import {
  type LanguageLevelTestView,
  type LevelTestAnswerInput,
  type LevelTestLength,
} from "@zoonk/core/language/level-test/contract";
import { safeAsync } from "@zoonk/utils/error";
import { useState, useTransition } from "react";
import { usePoll } from "../../_utils/use-poll";
import { StepLoading } from "../../onboarding/steps/step-parts";
import { rememberStepStart, wasStepStarted } from "../../onboarding/steps/step-started";
import { useReadOnOpen } from "../../onboarding/steps/use-read-on-open";
import {
  type BankWait,
  INITIAL_BANK_WAIT,
  askedBankWait,
  isBankStopped,
  toBankRun,
  updateBankWait,
} from "./level-test-bank";
import { LevelTestPreparing } from "./level-test-preparing";
import { LevelTestQuestion, SpeakingStep } from "./level-test-questions";
import { TestDone, TestIntro } from "./level-test-screens";

const POLL_MS = 3000;

type ReadyTest = Extract<LanguageLevelTestView, { status: "ready" }>;

export type LanguageLevelTestActions = {
  answer: (input: LevelTestAnswerInput) => Promise<LanguageLevelTestView | null>;
  finish: () => Promise<boolean>;
  /** Read-only: it never starts writing questions. */
  get: () => Promise<LanguageLevelTestView | null>;
  /** Only from the learner's tap, never when the screen opens; false when it couldn't start. */
  prepare: () => Promise<boolean>;
  speak: (audio: Blob) => Promise<LanguageLevelTestView | "noSpeech" | "signUpRequired" | null>;
  switchLanguage: (language: string) => void;
};

type Phase =
  | { kind: "done" | "loading" | "waiting" }
  | { kind: "intro"; showAlphabetNote: boolean }
  | { kind: "test"; test: ReadyTest };

function toReadyPhase(view: ReadyTest): Phase {
  return view.next.kind === "done" ? { kind: "done" } : { kind: "test", test: view };
}

function toResumedPhase({
  started,
  view,
}: {
  started: boolean;
  view: LanguageLevelTestView | null;
}): Phase {
  if (view?.status === "ready" && (started || view.answered > 0 || view.next.kind === "done")) {
    return toReadyPhase(view);
  }

  return view?.status === "preparing" && view.startedAt && started
    ? { kind: "waiting" }
    : { kind: "intro", showAlphabetNote: view?.showAlphabetNote ?? false };
}

function hasQuestion(
  next: ReadyTest["next"],
): next is Extract<ReadyTest["next"], { kind: "confirmation" | "question" }> {
  return next.kind === "question" || next.kind === "confirmation";
}

export function useLevelTestAudio({
  onRead,
  read,
  test,
}: {
  onRead: (view: ReadyTest) => void;
  read: () => Promise<LanguageLevelTestView | null>;
  test: ReadyTest | null;
}) {
  const next = test?.next;
  const question = next && hasQuestion(next) ? next.question : null;

  const poll = usePoll({
    active: Boolean(question?.audioPending),
    intervalMs: POLL_MS,
    key: question?.id,
    onPoll: async (signal) => {
      const view = await read();

      if (!view) {
        throw new Error("The level test couldn't be read");
      }

      if (
        !signal.aborted &&
        view.status === "ready" &&
        hasQuestion(view.next) &&
        view.next.question.id === question?.id
      ) {
        onRead(view);
      }
    },
    startNow: false,
  });

  return poll.status === "polling";
}

export function LanguageLevelTestStep({
  actions,
  goal,
  goalId,
  onDone,
  onFinishFailed,
  onWholeCourse,
  wholeCourseMinutes,
}: {
  actions: LanguageLevelTestActions;
  goal: { language: string; targetLanguage: string };
  goalId: string;
  /** Saves the step and resolves whether it went through; a failure is this step's to say. */
  onDone: () => Promise<boolean>;
  /** Says a finish that never reached the server, until the learner's next try. */
  onFinishFailed: (failed: boolean) => void;
  onWholeCourse: () => Promise<boolean>;
  wholeCourseMinutes: number;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [levels, setLevels] = useState<ReadyTest["levels"]>([]);
  const [bank, setBank] = useState<BankWait>(INITIAL_BANK_WAIT);
  const [stopFailed, setStopFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isStarting, startStarting] = useTransition();

  const show = (view: LanguageLevelTestView) => {
    if (view.status === "preparing") {
      setBank((current) => updateBankWait({ preparing: view, wait: current }));
      setPhase({ kind: "waiting" });
      return;
    }

    onFinishFailed(false);
    setLevels(view.levels);
    setPhase(toReadyPhase(view));
  };

  useReadOnOpen({
    onRead: (view) => {
      if (view?.status === "ready") {
        setLevels(view.levels);
      }

      if (view?.status === "preparing") {
        setBank(updateBankWait({ preparing: view, wait: INITIAL_BANK_WAIT }));
      }

      setPhase(toResumedPhase({ started: wasStepStarted({ goalId, step: "levelTest" }), view }));
    },
    read: actions.get,
  });

  const poll = usePoll({
    active: phase.kind === "waiting" && !isBankStopped(bank),
    intervalMs: POLL_MS,
    onPoll: async () => {
      const view = await actions.get();

      if (!view) {
        throw new Error("The level test couldn't be read");
      }

      show(view);
    },
  });

  const audioPending = useLevelTestAudio({
    onRead: (view) => setPhase({ kind: "test", test: view }),
    read: actions.get,
    test: phase.kind === "test" ? phase.test : null,
  });

  const begin = (length: LevelTestLength = "quick") =>
    startStarting(async () => {
      onFinishFailed(false);

      if (length === "wholeCourse") {
        onFinishFailed(!(await onWholeCourse().catch(() => false)));
        return;
      }

      rememberStepStart({ goalId, step: "levelTest" });
      setBank(INITIAL_BANK_WAIT);

      const { data: view } = await safeAsync(actions.get);

      if (view && (view.status === "ready" || view.startedAt)) {
        show(view);
        return;
      }

      setPhase({ kind: "waiting" });

      if (!view) {
        setBank({ ...INITIAL_BANK_WAIT, startFailed: true });
        return;
      }

      const { data: started } = await safeAsync(actions.prepare);
      setBank(askedBankWait({ preparing: view, started: Boolean(started) }));
    });

  const finish = () =>
    startTransition(async () => {
      setStopFailed(false);
      onFinishFailed(false);

      // Starting from scratch before the test was written finishes nothing (false) and moves on.
      const { error } = await safeAsync(actions.finish);
      const saved = !error && (await onDone().catch(() => false));
      onFinishFailed(!saved);
    });

  // Saving the finish ends the test, so a reload or another device shows this result too.
  const stop = () => {
    setPhase({ kind: "done" });

    startTransition(async () => {
      const { data: saved } = await safeAsync(actions.finish);
      setStopFailed(!saved);
    });
  };

  switch (phase.kind) {
    case "loading":
      return <StepLoading />;
    case "intro":
      return (
        <TestIntro
          goal={goal}
          onScratch={finish}
          onStart={begin}
          wholeCourseMinutes={wholeCourseMinutes}
          onSwitch={actions.switchLanguage}
          pending={isPending}
          showAlphabetNote={phase.showAlphabetNote}
          starting={isStarting}
        />
      );
    case "waiting":
      return (
        <LevelTestPreparing
          onSkip={finish}
          run={toBankRun({ poll: poll.status, recheck: poll.restart, retry: begin, wait: bank })}
          skipping={isPending}
          targetLanguage={goal.targetLanguage}
        />
      );
    case "done":
      return (
        <TestDone
          failed={stopFailed}
          levels={levels}
          onContinue={finish}
          pending={isPending}
          targetLanguage={goal.targetLanguage}
        />
      );
    case "test":
      return (
        <TestStep
          actions={actions}
          audioPending={audioPending}
          next={phase.test.next}
          onStop={stop}
          onView={show}
          progress={phase.test.answered / phase.test.total}
          targetLanguage={goal.targetLanguage}
        />
      );
    default:
      return null;
  }
}

export function TestStep({
  actions,
  audioPending,
  next,
  onStop,
  onView,
  progress,
  targetLanguage,
}: {
  actions: Pick<LanguageLevelTestActions, "answer" | "speak">;
  audioPending: boolean;
  next: ReadyTest["next"];
  onStop: () => void;
  onView: (view: LanguageLevelTestView) => void;
  progress: number;
  targetLanguage: string;
}) {
  if (next.kind === "speaking") {
    return (
      <SpeakingStep
        onSkip={onStop}
        onView={onView}
        progress={progress}
        sentence={next}
        speak={actions.speak}
      />
    );
  }

  return hasQuestion(next) ? (
    <LevelTestQuestion
      answer={actions.answer}
      audioPending={audioPending}
      key={next.question.id}
      onStop={onStop}
      onView={onView}
      progress={progress}
      question={next.question}
      selectAll={next.kind === "confirmation"}
      targetLanguage={targetLanguage}
    />
  ) : null;
}
