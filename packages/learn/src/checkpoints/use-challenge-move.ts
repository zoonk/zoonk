"use client";

import { type CheckpointView } from "@zoonk/core/checkpoints/contract";
import { useState } from "react";
import { type ChallengeMove, type CheckpointActions } from "./use-checkpoint-duel";

export type ChallengeMoveState = {
  /** Only the week's challenge moves, before it starts. */
  canMove: boolean;
  failed: boolean;
  moved: ChallengeMove | null;
  moveToMonday: () => Promise<void>;
  pending: boolean;
  undo: () => Promise<void>;
};

/** "Move to Monday" and its undo, with the screen saying plainly when either didn't go through. */
export function useChallengeMove({
  actions,
  checkpoint,
}: {
  actions: CheckpointActions;
  checkpoint: CheckpointView;
}): ChallengeMoveState {
  const [moved, setMoved] = useState<ChallengeMove | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function run<TResult>(request: () => Promise<TResult>): Promise<TResult> {
    setPending(true);
    setFailed(false);
    const result = await request();
    setPending(false);
    return result;
  }

  async function moveToMonday() {
    const result = await run(actions.move);
    setFailed(!result);
    setMoved(result);
  }

  async function undo() {
    const changeId = moved?.changeId;

    if (!changeId) {
      return;
    }

    const undone = await run(() => actions.undoMove(changeId));
    setFailed(!undone);

    if (undone) {
      setMoved(null);
    }
  }

  return {
    canMove: checkpoint.kind === "weekly" && checkpoint.status === "pending",
    failed,
    moveToMonday,
    moved,
    pending,
    undo,
  };
}
