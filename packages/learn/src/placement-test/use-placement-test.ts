"use client";

import { useState, useTransition } from "react";
import { usePoll } from "../_utils/use-poll";
import { type PlacementAnswer, type PlacementOutcome } from "../onboarding/onboarding-actions";
import { useReadOnOpen } from "../onboarding/steps/use-read-on-open";
import { type PlacementLength, type PlacementTestActions } from "./placement-test-actions";
import {
  type PlacementQuestionPhase,
  type PlacementTestPhase,
  toFinishedPhase,
  toPlacementTestPhase,
} from "./placement-test-phase";

const POLL_MS = 3000;

const FAILED: PlacementOutcome = { status: "failed" };

/** The button a save started from, which shows it's busy while the other waits. */
export type PlacementPressed = "main" | "other" | null;

export function getPlacementPressed({
  pending,
  starting,
}: {
  pending: boolean;
  starting: boolean;
}): PlacementPressed {
  if (starting) {
    return "main";
  }

  return pending ? "other" : null;
}

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

export function usePlacementTest({
  actions,
  onDone,
  onOnboardingDone,
}: {
  actions: PlacementTestActions;
  /** Goes back to the plan, read again; false when it didn't. */
  onDone: () => Promise<boolean>;
  onOnboardingDone?: (attemptId: string) => Promise<boolean>;
}) {
  const [phase, setPhase] = useState<PlacementTestPhase>({ kind: "loading" });
  const [failed, setFailed] = useState(false);
  const [pressed, setPressed] = useState<PlacementPressed>(null);
  const [isPending, startTransition] = useTransition();
  // Questions that arrived while the learner waited show once the wait moves on.
  const [arrived, setArrived] = useState<PlacementOutcome | null>(null);

  /** Closing a part applies what it skipped; another device that closed it first wins. */
  const close = async (attempt: { id: string; length: PlacementLength; part: number }) => {
    const finished = await actions.finish({ attemptId: attempt.id, part: attempt.part });

    if (finished.status === "failed") {
      return false;
    }

    if (finished.status === "stale") {
      setPhase(toPlacementTestPhase(await actions.get()));
      return true;
    }

    setPhase(toFinishedPhase({ attemptId: attempt.id, finished, length: attempt.length }));
    return true;
  };

  /** A part that's over closes in the same save; if that fails, its screen holds the retry. */
  const show = async (outcome: PlacementOutcome): Promise<boolean> => {
    const next = toPlacementTestPhase(outcome);

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

  const reopen = useReadOnOpen({
    onRead: (outcome) => {
      const next = toPlacementTestPhase(outcome ?? FAILED);

      if (
        onOnboardingDone &&
        next.kind === "choose" &&
        outcome?.status === "ready" &&
        outcome.result
      ) {
        setPhase({
          attemptId: outcome.result.attemptId,
          changeId: null,
          kind: "result",
          length: "wholeCourse",
          lessonsSkipped: outcome.result.lessonsSkipped,
          nextTopic: null,
        });

        return;
      }

      setPhase(next);
    },
    read: actions.get,
  });

  const poll = usePoll({
    active: phase.kind === "waiting" && arrived === null,
    intervalMs: POLL_MS,
    onPoll: async () => {
      const outcome = await actions.get();

      if (outcome.status === "failed") {
        throw new Error("The test couldn't be read");
      }

      if (outcome.status === "ready") {
        setArrived(outcome);
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

  const start = (length: PlacementLength) => async () => {
    const outcome = await actions.start(length).catch(() => FAILED);
    return outcome.status !== "failed" && show(outcome);
  };

  const answer =
    (from: PlacementQuestionPhase) => (choice: PlacementAnswer, durationMs: number) => {
      setFailed(false);

      startTransition(async () => {
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
    };

  return {
    answer,
    continueWait: () => {
      if (arrived) {
        setArrived(null);
        save(null, () => show(arrived));
      }
    },
    failed,
    isPending,
    onDone: (attemptId: string) =>
      save("main", () => (onOnboardingDone ? onOnboardingDone(attemptId) : onDone())),
    /** Closes a part the learner came back to after its questions ran out. */
    onFinishPart: (attempt: { id: string; length: PlacementLength; part: number }) =>
      save("main", () => close(attempt)),
    /** Another part of a whole-course test. */
    onKeepGoing: (length: PlacementLength) => save("main", start(length)),
    onLeave: () => save("other", () => onDone().catch(() => false)),
    onStart: (length: PlacementLength) => save("main", start(length)),
    phase,
    poll,
    pressed,
    questionsReady: arrived !== null,
    reopen,
    stop: (from: PlacementQuestionPhase) =>
      startTransition(async () => {
        if (!(await close(from.attempt).catch(() => false))) {
          setPhase((current) => countFailure({ current, from }));
        }
      }),
  };
}
