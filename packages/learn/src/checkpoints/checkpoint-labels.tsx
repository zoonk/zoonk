"use client";

import { type CheckpointPhase, type CheckpointView } from "@zoonk/core/checkpoints/contract";
import { useExtracted } from "next-intl";
import { useExperienceMode } from "../mode-provider";

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

/** "Phase 2 boss" in Fun, "Phase 2 checkpoint" in Focus; the weekly one by its name. */
export function useCheckpointEyebrow(checkpoint: CheckpointView): string {
  const t = useExtracted();
  const mode = useExperienceMode();
  const phase = phaseNumber(checkpoint);

  if (checkpoint.kind === "weekly") {
    if (mode === "fun") {
      return t("Big Challenge");
    }

    return t("Weekly challenge");
  }

  if (checkpoint.kind === "finalBoss") {
    return mode === "fun" ? t("Final boss") : t("Final checkpoint");
  }

  if (mode === "fun") {
    return phase ? t("Phase {phase} boss", { phase }) : t("Phase boss");
  }

  return phase ? t("Phase {phase} checkpoint", { phase }) : t("Phase checkpoint");
}

/** "10 mixed questions, no hints. Get 7 right to win." */
export function useCheckpointRules(checkpoint: CheckpointView): string {
  const t = useExtracted();
  const questions = String(checkpoint.questions.length);
  const passMark = String(checkpoint.passMark);

  if (checkpoint.kind === "weekly") {
    return t("{questions} mixed questions from this week, no hints.", { questions });
  }

  return t("{questions} mixed questions, no hints. Get {passMark} right to win.", {
    passMark,
    questions,
  });
}
