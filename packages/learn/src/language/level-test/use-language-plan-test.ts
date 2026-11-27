"use client";

import {
  type LanguageLevelTestView,
  type LevelTestAnswerInput,
  type LevelTestResult,
} from "@zoonk/core/language/level-test/contract";
import { type Dispatch, type SetStateAction, useState } from "react";
import { usePoll } from "../../_utils/use-poll";
import { type PlacementAnswer } from "../../onboarding/onboarding-actions";
import { useQuestionPoll } from "../../onboarding/steps/use-placement-question-poll";
import { type TestPressed } from "../../placement-test/test-offer";
import { type TestAnalytics } from "../../placement-test/use-test-analytics";
import { useTestVisit } from "../../placement-test/use-test-visit";
import {
  type BankWait,
  INITIAL_BANK_WAIT,
  askedBankWait,
  isBankStopped,
  toBankRun,
  updateBankWait,
} from "./level-test-bank";
import {
  type LevelTestPhase,
  type TestOutView,
  toOpenedLevelTestPhase,
  toTestOutPhase,
} from "./level-test-phase";

const POLL_MS = 3000;

type TestOutAnswer = PlacementAnswer;

export type LanguagePlanTestActions = {
  answer: (input: LevelTestAnswerInput) => Promise<LanguageLevelTestView | null>;
  /** Null when it wasn't saved. */
  finish: (
    attemptId: string,
  ) => Promise<{ nextTestOutLevel: string | null; result: LevelTestResult | null } | null>;
  /** Read-only: the test as it stands, an open attempt included. */
  get: () => Promise<LanguageLevelTestView | null>;
  /** Only from the learner's tap, never when the screen opens; false when it couldn't start. */
  prepare: () => Promise<boolean>;
  /** Opens a test, or answers with the one already open. */
  start: () => Promise<LanguageLevelTestView | null>;
  testOut: {
    answer: (input: {
      answer: TestOutAnswer;
      attemptId: string;
      durationMs: number;
      itemId: string;
    }) => Promise<TestOutView | null>;
    finish: (attemptId: string) => Promise<TestOutView | null>;
    /** Read-only. */
    get: (attemptId: string) => Promise<TestOutView | null>;
    start: (level: string) => Promise<TestOutView | null>;
  };
  undo: (changeId: string) => Promise<boolean>;
};

/** Where the flow runs. In onboarding a test the learner asked for (`direct`) starts as it opens. */
export type LevelTestHost =
  | {
      /** The learner told us their level, so the first lesson starts there. */
      levelGiven: boolean;
      mode: "direct" | "offer" | "resume";
      surface: "onboarding";
    }
  | { surface: "plan" };

type Saves = Pick<ReturnType<typeof useTestVisit>, "run" | "save" | "setFailed">;

type TestPhase = Extract<LevelTestPhase, { kind: "test" }>;

/** A save that failed counts on the question on screen, where its retry is. */
function countQuestionFailure(phase: LevelTestPhase): LevelTestPhase {
  return phase.kind === "test" || phase.kind === "testOut"
    ? { ...phase, failures: phase.failures + 1 }
    : phase;
}

/** A level's test-out, taken from the same screens: its questions can still be being written. */
function useLevelTestOut({
  actions,
  phase,
  saves: { run, save, setFailed },
  setPhase,
}: {
  actions: LanguagePlanTestActions["testOut"];
  phase: LevelTestPhase;
  saves: Saves;
  setPhase: Dispatch<SetStateAction<LevelTestPhase>>;
}) {
  const waiting = phase.kind === "testOutWaiting" ? phase : null;

  // Questions that arrived while the learner waited show once the wait moves on.
  const poll = useQuestionPoll({
    onReply: (wait, view: TestOutView) => (view.preparing ? wait : { ...wait, arrived: view }),
    read: (wait) => actions.get(wait.attemptId),
    setPhase,
    waiting,
  });

  const show = (view: TestOutView | null) => {
    if (!view) {
      setPhase(countQuestionFailure);
      return false;
    }

    setPhase(toTestOutPhase(view));
    return true;
  };

  const finish = (attemptId: string) =>
    actions
      .finish(attemptId)
      .then(show)
      .catch(() => show(null));

  return {
    arrivedTestOut: Boolean(waiting?.arrived),
    continueTestOut: () => {
      if (waiting?.arrived) {
        setPhase(toTestOutPhase(waiting.arrived));
      }
    },
    onTestOut: (level: string, button: Exclude<TestPressed, null>) =>
      save(button, () => actions.start(level).then(show)),
    onTestOutAnswer:
      (from: Extract<LevelTestPhase, { kind: "testOut" }>) =>
      (answer: TestOutAnswer, durationMs: number) =>
        run(async () => {
          const view = await actions
            .answer({
              answer,
              attemptId: from.view.attemptId,
              durationMs,
              itemId: from.question.itemId,
            })
            .catch(() => null);

          if (!view) {
            setPhase(countQuestionFailure);
            return;
          }

          const next = toTestOutPhase(view);
          setPhase(next);

          if (next.kind === "testOutFinish") {
            setFailed(!(await finish(next.attemptId)));
          }
        }),
    onTestOutStop: (attemptId: string) => save("other", () => finish(attemptId)),
    testOutPoll: poll,
  };
}

export function useLanguagePlanTest({
  actions,
  analytics,
  host,
  onLeave,
}: {
  actions: LanguagePlanTestActions;
  analytics: Pick<TestAnalytics, "markOpened" | "markStarted">;
  host: LevelTestHost;
  /** Leaves the test: onboarding goes on with setup, the Plan is read again. False when it didn't. */
  onLeave: () => Promise<boolean>;
}) {
  const { surface } = host;
  const asked = host.surface === "onboarding" && host.mode === "direct";
  const [phase, setPhase] = useState<LevelTestPhase>({ kind: "loading" });
  const [bank, setBank] = useState<BankWait>(INITIAL_BANK_WAIT);

  const finish = async (attemptId: string) => {
    const finished = await actions.finish(attemptId).catch(() => null);

    if (!finished) {
      setPhase({ attemptId, kind: "finish" });
      setFailed(true);
      return false;
    }

    setPhase({ kind: "result", ...finished });
    return true;
  };

  /** A test that asks nothing more closes in the same save. */
  const show = async (view: LanguageLevelTestView, attemptId: string): Promise<boolean> => {
    if (view.status === "preparing") {
      setBank((current) => updateBankWait({ preparing: view, wait: current }));
      setPhase({ attemptId, kind: "waiting" });
      return true;
    }

    if (view.next.kind !== "question" && view.next.kind !== "confirmation") {
      return finish(attemptId);
    }

    setPhase({ attemptId, failures: 0, kind: "test", test: view });
    return true;
  };

  const start = async () => {
    analytics.markStarted();
    const view = await actions.start().catch(() => null);
    return view?.attemptId ? show(view, view.attemptId) : false;
  };

  const open = async (view: LanguageLevelTestView | null) => {
    const next = toOpenedLevelTestPhase({ surface, view });

    if (next.kind === "offer" && asked) {
      if (!(await start())) {
        setPhase({ kind: "loadFailed" });
      }

      return;
    }

    if (view?.attemptId && (next.kind === "waiting" || next.kind === "finish")) {
      await show(view, view.attemptId);
      return;
    }

    setPhase(next);
  };

  const visit = useTestVisit({
    onRead: (view) => open(view),
    read: () => {
      analytics.markOpened();
      return actions.get();
    },
  });

  const { failed, isPending, pressed, reopen, run, save, setFailed } = visit;
  const testOut = useLevelTestOut({ actions: actions.testOut, phase, saves: visit, setPhase });

  const poll = usePoll({
    active: phase.kind === "waiting" && !isBankStopped(bank),
    intervalMs: POLL_MS,
    onPoll: async (signal) => {
      const view = await actions.get();

      if (!view) {
        throw new Error("The level test couldn't be read");
      }

      if (view.attemptId && !signal.aborted) {
        await show(view, view.attemptId);
      }
    },
  });

  /** Writing the questions again, only from the learner's "Try again". */
  const retry = () =>
    run(async () => {
      const started = await actions.prepare().catch(() => false);

      setBank((current) =>
        current.preparing ? askedBankWait({ preparing: current.preparing, started }) : current,
      );
    });

  return {
    ...testOut,
    bankRun: toBankRun({ poll: poll.status, recheck: poll.restart, retry, wait: bank }),
    failed,
    isPending,
    /** Answers and Stop share one pending save, so the question waits while either saves. */
    onAnswer: (from: TestPhase) => (input: Omit<LevelTestAnswerInput, "attemptId">) =>
      run(async () => {
        const view = await actions
          .answer({ ...input, attemptId: from.attemptId })
          .catch(() => null);

        if (!view) {
          setPhase(countQuestionFailure);
          return;
        }

        await show(view, from.attemptId);
      }),
    onLeave: (button: Exclude<TestPressed, null>) =>
      save(button, () => onLeave().catch(() => false)),
    onOpenLesson: (lessonId: string, openLesson?: (lessonId: string) => Promise<boolean>) =>
      save("main", () => (openLesson ? openLesson(lessonId) : onLeave()).catch(() => false)),
    onStart: () => save("main", start),
    onStop: (attemptId: string) => save("other", () => finish(attemptId)),
    onView: (attemptId: string) => (view: LanguageLevelTestView) =>
      run(async () => {
        await show(view, attemptId);
      }),
    phase,
    pressed,
    reopen,
  };
}
