"use client";

import {
  type LanguageLevelTestView,
  type LevelTestLength,
  type LevelTestResult,
} from "@zoonk/core/language/level-test/contract";
import { type LanguageLevelTestOutResult } from "@zoonk/core/language/level-test/test-out";
import { safeAsync } from "@zoonk/utils/error";
import { useState, useTransition } from "react";
import { usePoll } from "../../_utils/use-poll";
import { type PlacementAnswer, type PlacementQuestion } from "../../onboarding/onboarding-actions";
import { useReadOnOpen } from "../../onboarding/steps/use-read-on-open";
import { type PlacementPressed } from "../../placement-test/use-placement-test";
import {
  type BankWait,
  INITIAL_BANK_WAIT,
  askedBankWait,
  isBankStopped,
  toBankRun,
  updateBankWait,
} from "./level-test-bank";
import { type LevelTestQuestionActions } from "./level-test-step";

const POLL_MS = 3000;

type ReadyTest = Extract<LanguageLevelTestView, { status: "ready" }>;

export type TestOutView = Extract<LanguageLevelTestOutResult, { status: "ready" }>["test"];

type TestOutQuestion = NonNullable<TestOutView["next"]>;

type TestOutAnswer = PlacementAnswer;

export type LanguagePlanTestActions = LevelTestQuestionActions & {
  /** Null when it wasn't saved. */
  finish: (
    attemptId: string,
  ) => Promise<{ nextTestOutLevel: string | null; result: LevelTestResult | null } | null>;
  /** Read-only: the test as it stands, an open attempt included. */
  get: () => Promise<LanguageLevelTestView | null>;
  /** Only from the learner's tap, never when the screen opens; false when it couldn't start. */
  prepare: () => Promise<boolean>;
  start: (length: LevelTestLength) => Promise<LanguageLevelTestView | null>;
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
  /** Opens the whole-course test's walk through the course's topics; false when it didn't. */
  walkTopics: () => Promise<boolean>;
};

type Phase =
  | { kind: "loadFailed" | "loading" }
  | { kind: "choose"; showAlphabetNote: boolean }
  | { attemptId: string; kind: "waiting" }
  | { attemptId: string; kind: "finish"; length: LevelTestLength }
  | { attemptId: string; kind: "test"; test: ReadyTest }
  | {
      kind: "result";
      length: LevelTestLength;
      nextTestOutLevel: string | null;
      result: LevelTestResult | null;
    }
  | { failures: number; kind: "testOut"; question: PlacementQuestion; view: TestOutView }
  | { kind: "testOutResult"; view: TestOutView }
  /** A test-out whose questions are still being written. */
  | { attemptId: string; kind: "testOutWaiting" };

/** A page load goes on with an open test; otherwise the learner chooses one. */
function toOpenedPhase(view: LanguageLevelTestView | null, onboarding: boolean): Phase {
  if (!view) {
    return { kind: "loadFailed" };
  }

  const ownResult =
    view.attemptId && view.result?.attemptId === view.attemptId ? view.result : null;

  if (onboarding && ownResult) {
    return {
      kind: "result",
      length: view.length ?? "wholeCourse",
      nextTestOutLevel: null,
      result: ownResult,
    };
  }

  if (!view.attemptId || view.length === undefined || ownResult) {
    return { kind: "choose", showAlphabetNote: view.showAlphabetNote };
  }

  if (view.status === "preparing") {
    return { attemptId: view.attemptId, kind: "waiting" };
  }

  if (view.next.kind === "done") {
    return { attemptId: view.attemptId, kind: "finish", length: view.length };
  }

  return { attemptId: view.attemptId, kind: "test", test: view };
}

const TAP_FORMATS: readonly PlacementQuestion["format"][] = [
  "matchPairs",
  "multipleChoice",
  "order",
  "trueFalse",
];

function isTapFormat(format: string): format is PlacementQuestion["format"] {
  return TAP_FORMATS.some((tap) => tap === format);
}

/** A test-out asks taps only; anything else would be a question its screen can't take. */
function toPlacementQuestion(question: TestOutQuestion): PlacementQuestion | null {
  return isTapFormat(question.format) ? { ...question, format: question.format } : null;
}

function toTestOutPhase(view: TestOutView): Phase {
  if (view.preparing) {
    return { attemptId: view.attemptId, kind: "testOutWaiting" };
  }

  const question = view.next && toPlacementQuestion(view.next);

  return question
    ? { failures: 0, kind: "testOut", question, view }
    : { kind: "testOutResult", view };
}

export function useLanguagePlanTest({
  actions,
  onDone,
  onboarding,
}: {
  actions: LanguagePlanTestActions;
  onDone: () => Promise<boolean>;
  onboarding: boolean;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [failed, setFailed] = useState(false);
  const [pressed, setPressed] = useState<PlacementPressed>(null);
  const [isPending, startTransition] = useTransition();
  const [bank, setBank] = useState<BankWait>(INITIAL_BANK_WAIT);
  // Test-out questions that arrived while the learner waited show once the wait moves on.
  const [arrived, setArrived] = useState<TestOutView | null>(null);

  const reopen = useReadOnOpen({
    onRead: (view) => setPhase(toOpenedPhase(view, onboarding)),
    read: actions.get,
  });

  const finish = async (attemptId: string, length: LevelTestLength) => {
    const finished = await actions.finish(attemptId).catch(() => null);

    if (!finished) {
      setPhase({ attemptId, kind: "finish", length });
      setFailed(true);
      return false;
    }

    setPhase({ kind: "result", length, ...finished });
    return true;
  };

  /** A test that asks nothing more closes in the same save. */
  const show = async (view: LanguageLevelTestView, attemptId: string): Promise<boolean> => {
    if (view.status === "preparing") {
      setBank((current) => updateBankWait({ preparing: view, wait: current }));
      setPhase({ attemptId, kind: "waiting" });
      return true;
    }

    if (view.next.kind === "done") {
      return finish(attemptId, view.length ?? "quick");
    }

    setPhase({ attemptId, kind: "test", test: view });
    return true;
  };

  const poll = usePoll({
    active: phase.kind === "waiting" && !isBankStopped(bank),
    intervalMs: POLL_MS,
    onPoll: async () => {
      const view = await actions.get();

      if (!view) {
        throw new Error("The level test couldn't be read");
      }

      if (view.attemptId) {
        await show(view, view.attemptId);
      }
    },
  });

  const testOutPoll = usePoll({
    active: phase.kind === "testOutWaiting" && arrived === null,
    intervalMs: POLL_MS,
    onPoll: async () => {
      const view =
        phase.kind === "testOutWaiting" ? await actions.testOut.get(phase.attemptId) : null;

      if (!view) {
        throw new Error("The test couldn't be read");
      }

      if (!view.preparing) {
        setArrived(view);
      }
    },
  });

  const save = (button: PlacementPressed, action: () => Promise<boolean>) => {
    setPressed(button);
    setFailed(false);

    startTransition(async () => {
      const saved = await action().catch(() => false);
      setFailed(!saved);
      setPressed(null);
    });
  };

  const showTestOut = (view: TestOutView | null) => {
    if (!view) {
      return false;
    }

    setPhase(toTestOutPhase(view));
    return true;
  };

  /** Writing the questions again, only from the learner's "Try again". */
  const retry = () =>
    startTransition(async () => {
      const started = await actions.prepare().catch(() => false);

      setBank((current) =>
        current.preparing ? askedBankWait({ preparing: current.preparing, started }) : current,
      );
    });

  return {
    arrivedTestOut: arrived !== null,
    bankRun: toBankRun({ poll: poll.status, recheck: poll.restart, retry, wait: bank }),
    continueTestOut: () => {
      if (arrived) {
        setArrived(null);
        setPhase(toTestOutPhase(arrived));
      }
    },
    failed,
    isPending,
    onDone: () => save("main", () => onDone().catch(() => false)),
    onLeave: () => save("other", () => onDone().catch(() => false)),
    onSkip: (skip: () => Promise<boolean>) => save("other", skip),
    onStart: (length: LevelTestLength) =>
      save("main", async () => {
        const view = await actions.start(length);
        return view?.attemptId ? show(view, view.attemptId) : false;
      }),
    onStop: (attemptId: string, length: LevelTestLength) =>
      save("other", () => finish(attemptId, length)),
    onTestOut: (level: string) =>
      save("other", async () => showTestOut(await actions.testOut.start(level))),
    onTestOutAnswer:
      (from: Extract<Phase, { kind: "testOut" }>) => (answer: TestOutAnswer, durationMs: number) =>
        startTransition(async () => {
          const { data: view } = await safeAsync(() =>
            actions.testOut.answer({
              answer,
              attemptId: from.view.attemptId,
              durationMs,
              itemId: from.question.itemId,
            }),
          );

          if (!view) {
            setPhase((current) =>
              current.kind === "testOut" ? { ...current, failures: current.failures + 1 } : current,
            );

            return;
          }

          const closed = view.next
            ? view
            : await actions.testOut.finish(view.attemptId).catch(() => null);

          setPhase(toTestOutPhase(closed ?? view));
        }),
    onTestOutStop: (attemptId: string) =>
      save("other", async () => showTestOut(await actions.testOut.finish(attemptId))),
    onView: (attemptId: string) => (view: LanguageLevelTestView) => {
      void show(view, attemptId);
    },
    onWalkTopics: () => save("main", actions.walkTopics),
    phase,
    poll,
    pressed,
    reopen,
    testOutPoll,
  };
}
