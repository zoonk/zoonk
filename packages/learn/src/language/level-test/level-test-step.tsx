"use client";

import {
  type LanguageLevelTestView,
  type LevelTestAnswerInput,
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

type Phase = { kind: "done" | "intro" | "loading" | "waiting" } | { kind: "test"; test: ReadyTest };

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
  if (view?.status === "ready" && (started || view.answered > 0)) {
    return toReadyPhase(view);
  }

  return view?.status === "preparing" && view.startedAt && started
    ? { kind: "waiting" }
    : { kind: "intro" };
}

function getLanguageName(goal: { language: string; targetLanguage: string }): string {
  return (
    new Intl.DisplayNames([goal.language], { type: "language" }).of(goal.targetLanguage) ??
    goal.targetLanguage
  );
}

export function LanguageLevelTestStep({
  actions,
  goal,
  goalId,
  onDone,
}: {
  actions: LanguageLevelTestActions;
  goal: { language: string; targetLanguage: string };
  goalId: string;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [levels, setLevels] = useState<ReadyTest["levels"]>([]);
  const [bank, setBank] = useState<BankWait>(INITIAL_BANK_WAIT);
  const [isPending, startTransition] = useTransition();

  const show = (view: LanguageLevelTestView) => {
    if (view.status === "preparing") {
      setBank((current) => updateBankWait({ preparing: view, wait: current }));
      setPhase({ kind: "waiting" });
      return;
    }

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

  const begin = async () => {
    rememberStepStart({ goalId, step: "levelTest" });
    setBank(INITIAL_BANK_WAIT);
    setPhase({ kind: "waiting" });

    const { data: view } = await safeAsync(actions.get);

    if (view?.status !== "preparing" || view.startedAt) {
      if (view) {
        show(view);
      }

      return;
    }

    const { data: started } = await safeAsync(actions.prepare);
    setBank(askedBankWait({ preparing: view, started: Boolean(started) }));
  };

  const finish = () =>
    startTransition(async () => {
      await actions.finish();
      onDone();
    });

  switch (phase.kind) {
    case "loading":
      return <StepLoading />;
    case "intro":
      return (
        <TestIntro
          goal={goal}
          onScratch={finish}
          onStart={() => void begin()}
          onSwitch={actions.switchLanguage}
          pending={isPending}
        />
      );
    case "waiting":
      return (
        <LevelTestPreparing
          language={getLanguageName(goal)}
          onSkip={finish}
          run={toBankRun({
            poll: poll.status,
            recheck: poll.restart,
            retry: () => void begin(),
            wait: bank,
          })}
          skipping={isPending}
        />
      );
    case "done":
      return <TestDone levels={levels} onContinue={finish} pending={isPending} />;
    case "test":
      return (
        <TestStep
          actions={actions}
          next={phase.test.next}
          onStop={() => setPhase({ kind: "done" })}
          onView={show}
          progress={phase.test.answered / phase.test.total}
          targetLanguage={goal.targetLanguage}
        />
      );
    default:
      return null;
  }
}

function TestStep({
  actions,
  next,
  onStop,
  onView,
  progress,
  targetLanguage,
}: {
  actions: LanguageLevelTestActions;
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

  return next.kind === "question" ? (
    <LevelTestQuestion
      answer={actions.answer}
      onStop={onStop}
      onView={onView}
      progress={progress}
      question={next.question}
      targetLanguage={targetLanguage}
    />
  ) : null;
}
