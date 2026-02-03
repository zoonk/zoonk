"use client";

import { type PhaseStatus } from "@/lib/generation-phases";
import { type LessonStepName } from "@/workflows/config";
import { useExtracted } from "next-intl";
import {
  PHASE_ICONS,
  PHASE_ORDER,
  type PhaseName,
  calculateWeightedProgress,
  getPhaseStatus,
} from "./generation-phases";

export type PhaseInfo = {
  name: PhaseName;
  label: string;
  status: PhaseStatus;
  icon: (typeof PHASE_ICONS)[PhaseName];
};

export function useGenerationPhases(
  completedSteps: LessonStepName[],
  currentStep: LessonStepName | null,
) {
  const t = useExtracted();

  const labels: Record<PhaseName, string> = {
    completing: t("Finishing up"),
    determiningKind: t("Determining lesson type"),
    generatingActivities: t("Generating activities"),
    loadingInfo: t("Loading lesson information"),
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
