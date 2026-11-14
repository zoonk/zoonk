"use client";

import { useExtracted } from "next-intl";
import { type PhaseProgress, getPhaseProgress } from "./_utils/phase-progress";
import { type PhaseCopy } from "./generation-copy-types";
import { type GenerationKind, getGenerationKind } from "./generation-kinds";
import { type GenerationRun, isFollowing } from "./generation-run";
import { useGenerationCopy } from "./use-generation-copy";

export function getActiveStepLabel({
  copy,
  progress,
  run,
}: {
  copy: Record<string, PhaseCopy>;
  progress: PhaseProgress<string>;
  run: GenerationRun;
}): string | null {
  const active = progress.phases.find((phase) => phase.status === "active");
  return isFollowing(run) && active ? (copy[active.id]?.label ?? null) : null;
}

/** The step the run is on, in the words its progress lists it by, and "Done" once it's finished. */
export function useGenerationStepLabel({
  kind,
  run,
}: {
  kind: GenerationKind;
  run: GenerationRun;
}): string | null {
  const t = useExtracted();
  const copy = useGenerationCopy(kind);
  const progress = getPhaseProgress({ definition: getGenerationKind(kind), run });

  return progress.progress === 100
    ? t("Done")
    : getActiveStepLabel({ copy: copy.phases, progress, run });
}
