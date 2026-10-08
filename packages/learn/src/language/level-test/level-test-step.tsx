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

/** How the test reaches the server; the host implements these over its actions or the API. */
export type LanguageLevelTestActions = {
  answer: (input: LevelTestAnswerInput) => Promise<LanguageLevelTestView | null>;
  finish: () => Promise<boolean>;
  /** The test's next step; read-only, so it never starts writing questions. */
  get: () => Promise<LanguageLevelTestView | null>;
  /**
   * Asks for the pair's questions to be written when nothing is writing them: only from the
   * learner's tap (Start or Try again), never when the screen opens. False when it couldn't start.
   */
  prepare: () => Promise<boolean>;
  /** The sentence out loud; "noSpeech" when nothing was heard. */
  speak: (audio: Blob) => Promise<LanguageLevelTestView | "noSpeech" | null>;
  /** Shows the app in the learner's own language. */
  switchLanguage: (language: string) => void;
};

type Phase = { kind: "done" | "intro" | "loading" | "waiting" } | { kind: "test"; test: ReadyTest };

function toReadyPhase(view: ReadyTest): Phase {
  return view.next.kind === "done" ? { kind: "done" } : { kind: "test", test: view };
}

/**
 * Where the test was before a refresh: its next step once started, following a writer at work,
 * else its start. A writer that stopped waits for the learner's tap to ask again.
 */
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

/**
 * The three-minute level test of a language goal, in onboarding's placement step: reading and
 * listening questions that adapt to each answer, one sentence out loud, and the level of each
 * skill. It also offers the app in the learner's own language and, for a new script, says its
 * first session starts with the alphabet. When the pair's questions don't exist yet, the
 * learner's tap asks for them and the test waits with their progress, moving on by itself. A
 * refresh comes back to where it was. Skipping keeps the level the learner gave.
 */
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

  // A writer that stopped or a start that failed waits for the learner's "Try again".
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

  /**
   * The learner's tap (Start, or Try again after a failure): opens the test, and asks for its
   * questions when nothing writes them. The wait shows at once, with Skip in reach.
   */
  const begin = async () => {
    rememberStepStart({ goalId, step: "levelTest" });
    setBank(INITIAL_BANK_WAIT);
    setPhase({ kind: "waiting" });

    const { data: view } = await safeAsync(actions.get);

    // Ready opens the test and a writer at work is followed; a failed read shows by polling.
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
          targetLanguage={goal.targetLanguage}
        />
      );
    default:
      return null;
  }
}

/** The test's next question, or its one sentence out loud. */
function TestStep({
  actions,
  next,
  onStop,
  onView,
  targetLanguage,
}: {
  actions: LanguageLevelTestActions;
  next: ReadyTest["next"];
  onStop: () => void;
  onView: (view: LanguageLevelTestView) => void;
  targetLanguage: string;
}) {
  if (next.kind === "speaking") {
    return <SpeakingStep onSkip={onStop} onView={onView} sentence={next} speak={actions.speak} />;
  }

  return next.kind === "question" ? (
    <LevelTestQuestion
      answer={actions.answer}
      onStop={onStop}
      onView={onView}
      question={next.question}
      targetLanguage={targetLanguage}
    />
  ) : null;
}
