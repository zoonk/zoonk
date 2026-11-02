"use client";

import { type CheckpointPhase, type CheckpointView } from "@zoonk/core/checkpoints/contract";
import { useExtracted } from "next-intl";

export function phaseNumber(checkpoint: Pick<CheckpointView, "phase">): string | null {
  return checkpoint.phase ? String(checkpoint.phase.index + 1) : null;
}

export function usePhaseLabel() {
  const t = useExtracted();

  return (phase: CheckpointPhase): string =>
    phase.name || t("Phase {number, number}", { number: phase.index + 1 });
}

export function useCheckpointEyebrow(checkpoint: Pick<CheckpointView, "kind" | "phase">): string {
  const t = useExtracted();
  const phase = phaseNumber(checkpoint);

  if (checkpoint.kind === "weekly") {
    return t("Weekly challenge");
  }

  if (checkpoint.kind === "finalBoss") {
    return t("Final challenge");
  }

  return phase ? t("Phase {phase} challenge", { phase }) : t("Phase challenge");
}
