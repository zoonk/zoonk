"use client";

import { useState } from "react";
import { type ChallengeActions } from "./challenge-context";

export type ChallengeMoveState = {
  failed: boolean;
  moveToMonday: () => Promise<void>;
  pending: boolean;
  undo: (changeId: string) => Promise<void>;
};

/**
 * "Move to Monday" and its undo. Each goes on to the challenge on its day when it went through, so
 * the button stays busy until then; one that didn't go through says so plainly.
 */
export function useChallengeMove(actions: ChallengeActions): ChallengeMoveState {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function run(request: () => Promise<boolean>) {
    setPending(true);
    setFailed(false);

    const done = await request().catch(() => false);

    if (!done) {
      setPending(false);
      setFailed(true);
    }
  }

  return {
    failed,
    moveToMonday: () => run(actions.move),
    pending,
    undo: (changeId) => run(() => actions.undoMove(changeId)),
  };
}
