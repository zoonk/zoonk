"use client";

import {
  type LanguageLevelTestView,
  type LevelTestAnswerInput,
} from "@zoonk/core/language/level-test/contract";
import { safeAsync } from "@zoonk/utils/error";
import { getLanguageNameInSentence } from "@zoonk/utils/languages";
import { useState, useTransition } from "react";
import { usePoll } from "../../_utils/use-poll";
import { type LevelTestPlacement } from "../../certificates/placement-row";
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

/** Null when it didn't save. */
export type LevelTestFinish = { placement: LevelTestPlacement | null } | null;

export type LanguageLevelTestActions = {
  answer: (input: LevelTestAnswerInput) => Promise<LanguageLevelTestView | null>;
  finish: () => Promise<LevelTestFinish>;
  markPlacementShown: (code: string) => Promise<void>;
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

function getPendingAudioQuestion(phase: Phase): string | null {
  if (phase.kind !== "test" || phase.test.next.kind !== "question") {
    return null;
  }

  const { question } = phase.test.next;
  return question.audioPending ? question.id : null;
}

function withReadAudio({ phase, view }: { phase: Phase; view: LanguageLevelTestView }): Phase {
  if (
    phase.kind !== "test" ||
    phase.test.next.kind !== "question" ||
    view.status !== "ready" ||
    view.next.kind !== "question" ||
    view.next.question.id !== phase.test.next.question.id
  ) {
    return phase;
  }

  return { kind: "test", test: { ...phase.test, next: view.next } };
}

/**
 * The test ends when its last answer lands (or the learner stops): saving the finish then lets a
 * reload or another device show this result, and the last screen show its placement. Leaving with
 * the placement's row on screen counts it as seen; one never shown comes back at the end of the
 * learner's next task instead.
 */
function useLevelTestFinish({
  actions,
  onDone,
}: {
  actions: LanguageLevelTestActions;
  onDone: () => void;
}) {
  const [saved, setSaved] = useState<LevelTestFinish>(null);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      const { data } = await safeAsync(actions.finish);
      setFailed(!data);
      setSaved(data ?? null);
    });
  };

  /** Only a finish this screen didn't save (a failed save, a resumed screen, a skip) saves here. */
  const finish = () =>
    startTransition(async () => {
      setFailed(false);
      const shown = saved?.placement?.facts.code;

      if (!saved) {
        await actions.finish();
      }

      if (shown) {
        await safeAsync(() => actions.markPlacementShown(shown));
      }

      onDone();
    });

  return { failed, finish, isPending, placement: saved?.placement ?? null, save };
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
  const [isStarting, startStarting] = useTransition();
  const ending = useLevelTestFinish({ actions, onDone });
  const { finish, isPending } = ending;

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

  const audioQuestion = getPendingAudioQuestion(phase);

  const audioPoll = usePoll({
    active: audioQuestion !== null,
    intervalMs: POLL_MS,
    key: audioQuestion ?? undefined,
    onPoll: async () => {
      const view = await actions.get();

      if (!view) {
        throw new Error("The level test couldn't be read");
      }

      setPhase((current) => withReadAudio({ phase: current, view }));
    },
    startNow: false,
  });

  const begin = () =>
    startStarting(async () => {
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

  const stop = () => {
    setPhase({ kind: "done" });
    ending.save();
  };

  /** The learner's last answer ends the test: saving it then lets its result show its placement. */
  const showAnswered = (view: LanguageLevelTestView) => {
    show(view);

    if (view.status === "ready" && view.next.kind === "done") {
      ending.save();
    }
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
          onSwitch={actions.switchLanguage}
          pending={isPending}
          showAlphabetNote={phase.showAlphabetNote}
          starting={isStarting}
        />
      );
    case "waiting":
      return (
        <LevelTestPreparing
          language={getLanguageNameInSentence({
            targetLanguage: goal.targetLanguage,
            userLanguage: goal.language,
          })}
          onSkip={finish}
          run={toBankRun({ poll: poll.status, recheck: poll.restart, retry: begin, wait: bank })}
          skipping={isPending}
        />
      );
    case "done":
      return (
        <TestDone
          failed={ending.failed}
          levels={levels}
          onContinue={finish}
          pending={isPending}
          placement={ending.placement}
        />
      );
    case "test":
      return (
        <TestStep
          actions={actions}
          audioPending={audioPoll.status === "polling"}
          next={phase.test.next}
          onStop={stop}
          onView={showAnswered}
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
  audioPending,
  next,
  onStop,
  onView,
  progress,
  targetLanguage,
}: {
  actions: LanguageLevelTestActions;
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

  return next.kind === "question" ? (
    <LevelTestQuestion
      answer={actions.answer}
      audioPending={audioPending}
      key={next.question.id}
      onStop={onStop}
      onView={onView}
      progress={progress}
      question={next.question}
      targetLanguage={targetLanguage}
    />
  ) : null;
}
