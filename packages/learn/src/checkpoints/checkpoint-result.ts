import { type CheckpointView } from "@zoonk/core/checkpoints/contract";
import { getOwnBrainPower } from "../session/block-brain-power";

type ResultCheckpoint = Pick<CheckpointView, "kind" | "nextPhase" | "retry" | "reward">;

export type ResultRows = {
  badge: boolean;
  nextPhase: CheckpointView["nextPhase"];
  phaseComplete: boolean;
  retry: boolean;
};

/** The rows beside a result. Its Brain Power is the score's readout, as at every task's end, never a row. */
export function getResultRows({
  checkpoint,
  hasRetry,
  won,
}: {
  checkpoint: ResultCheckpoint;
  hasRetry: boolean;
  won: boolean;
}): ResultRows {
  const { kind, nextPhase, retry, reward } = checkpoint;

  if (won) {
    return {
      badge: reward.badge,
      nextPhase: reward.phaseComplete && kind !== "weekly" ? nextPhase : null,
      phaseComplete: reward.phaseComplete,
      retry: false,
    };
  }

  return {
    badge: false,
    nextPhase: retry === "passed" ? null : nextPhase,
    phaseComplete: false,
    retry: hasRetry,
  };
}

export function hasResultRows(rows: ResultRows): boolean {
  return rows.badge || rows.phaseComplete || rows.retry || rows.nextPhase !== null;
}

/** A result reopened later has no completion: a win shows its prize, a loss nothing. */
export function getEarnedBrainPower({
  completion,
  prize,
  won,
}: {
  completion: Parameters<typeof getOwnBrainPower>[0] | null;
  prize: number;
  won: boolean;
}): number {
  if (completion) {
    return getOwnBrainPower(completion);
  }

  return won ? prize : 0;
}
