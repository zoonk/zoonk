"use client";

import { type CheckpointPhase, type CheckpointView } from "@zoonk/core/checkpoints/contract";
import { useExtracted, useFormatter } from "next-intl";

type CheckpointKind = CheckpointView["kind"];

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

/** What a checkpoint is worth, said before it starts: a boss pays when won, a weekly one when done. */
export function useCheckpointWorth({
  brainPower,
  kind,
  phase,
}: {
  brainPower: number;
  kind: CheckpointKind;
  phase: CheckpointPhase | null;
}): string {
  const t = useExtracted();
  const format = useFormatter();
  const points = format.number(brainPower);

  if (kind === "weekly") {
    return t("Finishing adds {points} Brain Power.", { points });
  }

  return phase
    ? t("Winning adds {points} Brain Power and completes phase {phase}.", {
        phase: String(phase.index + 1),
        points,
      })
    : t("Winning adds {points} Brain Power.", { points });
}
