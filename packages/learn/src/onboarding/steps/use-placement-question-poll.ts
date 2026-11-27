"use client";

import { type Dispatch, type SetStateAction } from "react";
import { usePoll } from "../../_utils/use-poll";
import { type PlacementOutcome } from "../onboarding-actions";

type Ready = Extract<PlacementOutcome, { status: "ready" }>;
type Progress = Exclude<PlacementOutcome, Ready | { status: "failed" }>;

export type PlacementQuestionWait = { arrived?: Ready; kind: "waiting" };

export function usePlacementQuestionPoll<Phase>({
  onProgress,
  paused = false,
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
  return usePoll({
    active: waiting !== null && !waiting.arrived && !paused,
    intervalMs: 3000,
    onPoll: async (signal) => {
      const outcome = await read();

      if (signal.aborted || !waiting) {
        return;
      }

      if (outcome.status === "failed") {
        throw new Error("The test couldn't be read");
      }

      setPhase((current) => {
        if (current !== waiting) {
          return current;
        }

        return outcome.status === "ready"
          ? { ...waiting, arrived: outcome }
          : (onProgress?.(waiting, outcome) ?? current);
      });
    },
  });
}
