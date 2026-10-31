"use client";

import { useTakingLong } from "@zoonk/ui/hooks/taking-long";
import { settleWithin } from "@zoonk/utils/timeout";
import { useState } from "react";
import { type ChallengeActions } from "./challenge-context";

/** A retry after the timeout is safe: a started block resumes. */
const START_BOUNDS = { slowMs: 10_000, timeoutMs: 45_000 } as const;

type StartProblem = "failed" | "plusRequired" | null;

export type ChallengeStartState = {
  busy: boolean;
  problem: StartProblem;
  slow: boolean;
  start: () => Promise<void>;
};

export function useChallengeStart(actions: ChallengeActions): ChallengeStartState {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<StartProblem>(null);
  const slow = useTakingLong({ active: busy, afterMs: START_BOUNDS.slowMs });

  async function start() {
    setBusy(true);
    setProblem(null);

    const settled = await settleWithin({
      ms: START_BOUNDS.timeoutMs,
      request: actions.start,
    }).catch(() => null);

    const outcome = settled?.status === "settled" ? settled.value : "failed";

    // "started" keeps the button busy while the host opens the block. The host reads a changed day
    // itself, so it isn't a failure.
    if (
      outcome === "writing" ||
      outcome === "notToday" ||
      outcome === "dailyLimitReached" ||
      typeof outcome === "object"
    ) {
      setBusy(false);
    } else if (outcome !== "started") {
      setBusy(false);
      setProblem(outcome);
    }
  }

  return { busy, problem, slow, start };
}
