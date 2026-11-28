"use client";

import { type Dispatch, type SetStateAction } from "react";
import { usePoll } from "../../_utils/use-poll";
import { type PlacementOutcome } from "../onboarding-actions";

/** A wait for a test's questions: the reply that has them is kept on the wait it answered. */
type QuestionWait<Arrived> = { arrived?: Arrived };

/**
 * Checks on a wait for a test's questions. A reply lands only on the wait it was asked for, so one
 * that comes back after the learner left, or for an earlier test, never opens on another screen.
 */
export function useQuestionPoll<Phase, Wait extends QuestionWait<unknown>, Reply>({
  onReply,
  paused = false,
  read,
  setPhase,
  waiting,
}: {
  /** What a reply makes of the wait it answered. */
  onReply: (wait: Wait, reply: Reply) => NoInfer<Phase>;
  paused?: boolean;
  /** Null when the test couldn't be read. */
  read: (wait: Wait) => Promise<Reply | null>;
  setPhase: Dispatch<SetStateAction<Phase>>;
  waiting: Wait | null;
}) {
  return usePoll({
    active: waiting !== null && !waiting.arrived && !paused,
    intervalMs: 3000,
    onPoll: async (signal) => {
      const reply = waiting && (await read(waiting));

      if (signal.aborted || !waiting) {
        return;
      }

      if (reply === null) {
        throw new Error("The test couldn't be read");
      }

      setPhase((current) => (Object.is(current, waiting) ? onReply(waiting, reply) : current));
    },
  });
}

type Ready = Extract<PlacementOutcome, { status: "ready" }>;
type Progress = Exclude<PlacementOutcome, Ready | { status: "failed" }>;

export type PlacementQuestionWait = QuestionWait<Ready> & { kind: "waiting" };

export function usePlacementQuestionPoll<Phase>({
  onProgress,
  paused,
  read,
  setPhase,
  waiting,
}: {
  onProgress?: (wait: Phase & PlacementQuestionWait, outcome: Progress) => Phase;
  paused?: boolean;
  read: () => Promise<PlacementOutcome>;
  setPhase: Dispatch<SetStateAction<Phase>>;
  waiting: (Phase & PlacementQuestionWait) | null;
}) {
  return useQuestionPoll({
    onReply: (wait, outcome: Exclude<PlacementOutcome, { status: "failed" }>) =>
      outcome.status === "ready"
        ? { ...wait, arrived: outcome }
        : (onProgress?.(wait, outcome) ?? wait),
    paused,
    read: async () => {
      const outcome = await read();
      return outcome.status === "failed" ? null : outcome;
    },
    setPhase,
    waiting,
  });
}
