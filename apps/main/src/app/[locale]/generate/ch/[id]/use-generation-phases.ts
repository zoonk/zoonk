"use client";

import { useExtracted } from "next-intl";
import {
  PHASE_ICONS,
  PHASE_ORDER,
  type PhaseName,
  calculateWeightedProgress,
  getPhaseStatus,
} from "./generation-phases";
import type { PhaseStatus } from "@/lib/generation-phases";
import type { ChapterStepName } from "@/workflows/config";

type PhaseLabels = Record<PhaseName, string>;

export type PhaseInfo = {
  name: PhaseName;
  label: string;
  status: PhaseStatus;
  icon: (typeof PHASE_ICONS)[PhaseName];
};

export function useGenerationPhases(
  completedSteps: ChapterStepName[],
  currentStep: ChapterStepName | null,
) {
  const t = useExtracted();

  const labels: PhaseLabels = {
    completing: t("Finishing up"),
    generatingLessons: t("Generating lessons"),
    loadingInfo: t("Loading chapter information"),
  };

  const phases: PhaseInfo[] = PHASE_ORDER.map((phase) => ({
    icon: PHASE_ICONS[phase],
    label: labels[phase],
    name: phase,
    status: getPhaseStatus(phase, completedSteps, currentStep),
  }));

  const progress = calculateWeightedProgress(completedSteps, currentStep);
  const activePhase = phases.find((phase) => phase.status === "active");

  return { activePhase, phases, progress };
}
