"use client";

import { type CheckpointPhase, type CheckpointView } from "@zoonk/core/checkpoints/contract";
import { useExtracted } from "next-intl";

/** Phases count from one for people. */
export function phaseNumber(checkpoint: Pick<CheckpointView, "phase">): string | null {
  return checkpoint.phase ? String(checkpoint.phase.index + 1) : null;
}

/** A phase by its name, or by its number when the plan gives it none (an exam's phases). */
export function usePhaseLabel() {
  const t = useExtracted();

  return (phase: CheckpointPhase): string =>
    phase.name || t("Phase {number, number}", { number: phase.index + 1 });
}

/** "Phase 2 checkpoint"; the weekly one by its name. */
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
