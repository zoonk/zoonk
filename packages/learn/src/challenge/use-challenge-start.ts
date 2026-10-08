"use client";

import { useTakingLong } from "@zoonk/ui/hooks/taking-long";
import { settleWithin } from "@zoonk/utils/timeout";
import { useState } from "react";
import { type ChallengeActions } from "./challenge-context";

/**
 * Starting plans today's session when it isn't yet and starts the block (a mock's sections and
 * clock): database work of a second or two. Past `slowMs` the screen says it's still at it, and
 * past `timeoutMs` it stops waiting and offers to try again, which is safe (a started block
 * resumes).
 */
const START_BOUNDS = { slowMs: 10_000, timeoutMs: 45_000 } as const;

type StartProblem = "dailyLimitReached" | "failed" | null;

export type ChallengeStartState = {
  busy: boolean;
  problem: StartProblem;
  slow: boolean;
  start: () => Promise<void>;
};

/** "Start": the host opens the challenge's block once it started; a failure says so plainly. */
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

    // Once it started, the host is already opening the block: the button stays busy until then.
    if (outcome !== "started") {
      setBusy(false);
      setProblem(outcome);
    }
  }

  return { busy, problem, slow, start };
}
