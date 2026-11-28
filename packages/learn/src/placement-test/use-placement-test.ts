"use client";

import { useState } from "react";
import { type GenerationRun } from "../generation/generation-run";
import { type PlacementAnswer, type PlacementOutcome } from "../onboarding/onboarding-actions";
import { usePlacementQuestionPoll } from "../onboarding/steps/use-placement-question-poll";
import { isRunStopped } from "../onboarding/steps/wait-run";
import { type PlacementTestActions } from "./placement-test-actions";
import {
  type PlacementQuestionPhase,
  type PlacementTestPhase,
  answerOrRead,
  toFinishedPhase,
  toPlacementTestPhase,
} from "./placement-test-phase";
import { type TestPressed } from "./test-offer";
import { type TestAnalytics } from "./use-test-analytics";
import { useTestVisit } from "./use-test-visit";

const FAILED: PlacementOutcome = { status: "failed" };

/** Where the flow runs. In onboarding a test the learner asked for (`direct`) starts as it opens. */
export type PlacementTestHost =
  | {
      /** "First lesson": saves that the learner starts without a test; false when it didn't. */
      decline: () => Promise<boolean>;
      firstLessonTitle: string | null;
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

type OpenAttempt = { id: string };

export function usePlacementTest({
  actions,
  analytics,
  canStart,
  host,
  onLeave,
  run: build,
}: {
  actions: PlacementTestActions;
  analytics: Pick<TestAnalytics, "markOpened" | "markStarted">;
  canStart: boolean;
  host: PlacementTestHost;
  /** Leaves the test: onboarding goes on with setup, the Plan is read again. False when it didn't. */
  onLeave: (attemptId?: string) => Promise<boolean>;
  /** The run building the course, in onboarding: a wait for it stops checking once it stops. */
  run: GenerationRun | null;
}) {
  const { surface } = host;
  const direct = host.surface === "onboarding" && host.mode === "direct";

  const offered = host.surface === "onboarding" && host.mode === "offer";
  const [phase, setPhase] = useState<PlacementTestPhase>({ kind: offered ? "offer" : "loading" });
  const waiting = phase.kind === "waiting" ? phase : null;

  /**
   * Closing the test applies where it starts the learner; another device that closed it first wins.
   * A stop sends the answers its question showed, so a stop from a question another device moved
   * past is refused.
   */
  const close = async (attempt: OpenAttempt, answered?: number) => {
    const finished = await actions.finish({ answered, attemptId: attempt.id });

    if (finished.status === "failed") {
      return false;
    }

    if (finished.status === "stale") {
      setPhase(
        toPlacementTestPhase({
          asked: true,
          attemptId: attempt.id,
          canStart,
          outcome: await actions.get(),
          surface,
        }),
      );

      return true;
    }

    setPhase(toFinishedPhase({ attemptId: attempt.id, finished }));
    return true;
  };

  /** A test that's over closes in the same save; if that fails, its screen holds the retry. */
  const show = async (
    outcome: PlacementOutcome,
    asked: boolean,
    attemptId?: string,
  ): Promise<boolean> => {
    const next = toPlacementTestPhase({ asked, attemptId, canStart, outcome, surface });

    if (next.kind !== "over") {
      setPhase(next);
      return true;
    }

    const closed = await close(next.attempt).catch(() => false);

    if (!closed) {
      setPhase(next);
    }

    return closed;
  };

  const start = async () => {
    analytics.markStarted();
    const outcome = await actions.start().catch(() => FAILED);
    return outcome.status !== "failed" && show(outcome, true);
  };

  const open = async (outcome: PlacementOutcome) => {
    const next = toPlacementTestPhase({ canStart, outcome, surface });

    if (next.kind !== "offer" || !direct) {
      await show(outcome, false).catch(() => setPhase(next));
      return;
    }

    if (!(await start().catch(() => false))) {
      setPhase({ kind: "loadFailed" });
    }
  };

  const { failed, isPending, pressed, reopen, run, save, setFailed } = useTestVisit({
    onRead: (outcome) => open(outcome ?? FAILED),
    opened: offered,
    read: () => {
      analytics.markOpened();
      return actions.get();
    },
  });

  const poll = usePlacementQuestionPoll<PlacementTestPhase>({
    onProgress: (wait, outcome) =>
      outcome.status === "generationFailed" || outcome.status === "unavailable"
        ? toPlacementTestPhase({ asked: true, outcome, surface })
        : wait,
    paused: Boolean(waiting?.retry) || isRunStopped(build),
    read: actions.get,
    setPhase,
    waiting,
  });

  const answer = (from: PlacementQuestionPhase) => (choice: PlacementAnswer, durationMs: number) =>
    run(async () => {
      const outcome = await answerOrRead({
        answer: () =>
          actions.answer({
            answer: choice,
            attemptId: from.attempt.id,
            durationMs,
            itemId: from.question.itemId,
          }),
        question: from.question,
        read: actions.get,
      });

      if (!outcome) {
        setPhase((current) => countFailure({ current, from }));
        return;
      }

      setFailed(!(await show(outcome, true, from.attempt.id).catch(() => false)));
    });

  return {
    answer,
    continueWait: () => {
      const arrived = waiting?.arrived;

      if (arrived) {
        save(null, () => show(arrived, true));
      }
    },
    failed,
    isPending,
    onDecline: () =>
      save("main", async () =>
        host.surface === "onboarding" && (await host.decline()) ? onLeave() : false,
      ),
    onFinish: (attempt: OpenAttempt) => save("main", () => close(attempt)),
    onLeave: (button: Exclude<TestPressed, null>, attemptId?: string) =>
      save(button, () => onLeave(attemptId).catch(() => false)),
    onOpenLesson: (lessonId: string, openLesson?: (lessonId: string) => Promise<boolean>) =>
      save("main", () => (openLesson ? openLesson(lessonId) : onLeave()).catch(() => false)),
    onRetryWait: () => {
      if (!isPending && waiting?.retry) {
        save("main", start);
      }
    },
    onStart: () => save("main", start),
    phase,
    poll,
    pressed,
    questionsReady: Boolean(waiting?.arrived),
    reopen,
    stop: (from: PlacementQuestionPhase) =>
      run(async () => {
        if (!(await close(from.attempt, from.attempt.answered).catch(() => false))) {
          setPhase((current) => countFailure({ current, from }));
        }
      }),
  };
}
