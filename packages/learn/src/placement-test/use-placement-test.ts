"use client";

import { useState } from "react";
import { type PlacementAnswer, type PlacementOutcome } from "../onboarding/onboarding-actions";
import { usePlacementQuestionPoll } from "../onboarding/steps/use-placement-question-poll";
import { useReadOnOpen } from "../onboarding/steps/use-read-on-open";
import { type PlacementLength, type PlacementTestActions } from "./placement-test-actions";
import {
  type PlacementQuestionPhase,
  type PlacementTestPhase,
  toFinishedPhase,
  toPlacementTestPhase,
} from "./placement-test-phase";
import { type TestPressed } from "./test-offer";
import { type TestAnalytics } from "./use-test-analytics";
import { useTestSaves } from "./use-test-saves";

const FAILED: PlacementOutcome = { status: "failed" };

/** Where the flow runs. In onboarding a test the learner asked for (`direct`) starts as it opens. */
export type PlacementTestHost =
  | {
      /** "First lesson": saves that the learner starts without a test; false when it didn't. */
      decline: () => Promise<boolean>;
      mode: "direct" | "offer" | "resume";
      surface: "onboarding";
    }
  | { surface: "plan" };

/** A save that failed counts on the question it came from, where its retry is. */
function countFailure({
  current,
  from,
}: {
  current: PlacementTestPhase;
  from: PlacementQuestionPhase;
}): PlacementTestPhase {
  return current.kind === "question" && current.question.itemId === from.question.itemId
    ? { ...current, failures: current.failures + 1 }
    : current;
}

type OpenAttempt = { id: string; part: number };

export function usePlacementTest({
  actions,
  analytics,
  host,
  onLeave,
}: {
  actions: PlacementTestActions;
  analytics: Pick<TestAnalytics, "markOpened" | "markStarted">;
  host: PlacementTestHost;
  /** Leaves the test: onboarding goes on with setup, the Plan is read again. False when it didn't. */
  onLeave: (attemptId?: string) => Promise<boolean>;
}) {
  const { surface } = host;
  const asked = host.surface === "onboarding" && host.mode === "direct";

  const [phase, setPhase] = useState<PlacementTestPhase>({
    kind: host.surface === "onboarding" && host.mode === "offer" ? "offer" : "loading",
  });

  const { failed, hasActed, isPending, markRead, pressed, run, save, setFailed } = useTestSaves();
  const waiting = phase.kind === "waiting" ? phase : null;

  /** Closing a part applies what it skipped; another device that closed it first wins. */
  const close = async (attempt: OpenAttempt) => {
    const finished = await actions.finish({ attemptId: attempt.id, part: attempt.part });

    if (finished.status === "failed") {
      return false;
    }

    if (finished.status === "stale") {
      setPhase(toPlacementTestPhase({ outcome: await actions.get(), surface }));
      return true;
    }

    setPhase(toFinishedPhase({ attemptId: attempt.id, finished }));
    return true;
  };

  /** A part that's over closes in the same save; if that fails, its screen holds the retry. */
  const show = async (outcome: PlacementOutcome): Promise<boolean> => {
    const next = toPlacementTestPhase({ outcome, surface });

    if (next.kind !== "partOver") {
      setPhase(next);
      return true;
    }

    const closed = await close(next.attempt).catch(() => false);

    if (!closed) {
      setPhase(next);
    }

    return closed;
  };

  const start = (length: PlacementLength) => async () => {
    analytics.markStarted();
    const outcome = await actions.start(length).catch(() => FAILED);
    return outcome.status !== "failed" && show(outcome);
  };

  /** A read that comes back after the learner pressed something no longer says where they are. */
  const open = async (outcome: PlacementOutcome) => {
    if (hasActed()) {
      return;
    }

    const next = toPlacementTestPhase({ outcome, surface });

    if (next.kind !== "offer" || !asked) {
      await show(outcome).catch(() => setPhase(next));
      return;
    }

    if (!(await start("quick")().catch(() => false))) {
      setPhase({ kind: "loadFailed" });
    }
  };

  const reopen = useReadOnOpen({
    onRead: (outcome) => void open(outcome ?? FAILED),
    read: () => {
      markRead();
      analytics.markOpened();
      return actions.get();
    },
  });

  const poll = usePlacementQuestionPoll<PlacementTestPhase>({
    onProgress: (wait, outcome) =>
      outcome.status === "generationFailed" || outcome.status === "unavailable"
        ? toPlacementTestPhase({ outcome, surface })
        : wait,
    paused: Boolean(waiting?.failedAttempt),
    read: actions.get,
    setPhase,
    waiting,
  });

  const answer = (from: PlacementQuestionPhase) => (choice: PlacementAnswer, durationMs: number) =>
    run(async () => {
      const outcome = await actions
        .answer({
          answer: choice,
          attemptId: from.attempt.id,
          durationMs,
          itemId: from.question.itemId,
          part: from.attempt.part,
        })
        .catch(() => FAILED);

      if (outcome.status === "failed") {
        setPhase((current) => countFailure({ current, from }));
        return;
      }

      setFailed(!(await show(outcome).catch(() => false)));
    });

  return {
    answer,
    continueWait: () => {
      const arrived = waiting?.arrived;

      if (arrived) {
        save(null, () => show(arrived));
      }
    },
    failed,
    isPending,
    /** The full test from here on: its next part, the part it stopped in, or the rest after a short test. */
    onContinue: () => save("main", start("wholeCourse")),
    onDecline: () =>
      save("main", async () =>
        host.surface === "onboarding" && (await host.decline()) ? onLeave() : false,
      ),
    /** Closes a part the learner came back to after its questions ran out. */
    onFinishPart: (attempt: OpenAttempt) => save("main", () => close(attempt)),
    onLeave: (button: Exclude<TestPressed, null>, attemptId?: string) =>
      save(button, () => onLeave(attemptId).catch(() => false)),
    onOpenLesson: (lessonId: string, openLesson?: (lessonId: string) => Promise<boolean>) =>
      save("main", () => (openLesson ? openLesson(lessonId) : onLeave()).catch(() => false)),
    onRetryWait: () => {
      if (!isPending) {
        save("main", start(waiting?.failedAttempt?.length ?? "quick"));
      }
    },
    onStart: (length: PlacementLength) => save("main", start(length)),
    /** "Test the rest" sits beside the result's main action. */
    onTestTheRest: () => save("other", start("wholeCourse")),
    phase,
    poll,
    pressed,
    questionsReady: Boolean(waiting?.arrived),
    reopen,
    stop: (from: PlacementQuestionPhase) =>
      run(async () => {
        if (!(await close(from.attempt).catch(() => false))) {
          setPhase((current) => countFailure({ current, from }));
        }
      }),
  };
}
