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

export function useGenerationPhases(
  completedSteps: LessonStepName[],
  currentStep: LessonStepName | null,
) {
  const t = useExtracted();

  const labels: Record<PhaseName, string> = {
    figuringOutApproach: t("Figuring out the best approach"),
    finishing: t("Almost done"),
    gettingStarted: t("Getting started"),
    settingUpActivities: t("Setting up activities"),
  };

  const phases: {
    name: PhaseName;
    label: string;
    status: PhaseStatus;
    icon: (typeof PHASE_ICONS)[PhaseName];
  }[] = PHASE_ORDER.map((phase) => ({
    icon: PHASE_ICONS[phase],
    label: labels[phase],
    name: phase,
    status: getPhaseStatus(phase, completedSteps, currentStep),
  }));

  const progress = calculateWeightedProgress(completedSteps, currentStep);
  const activePhase = phases.find((phase) => phase.status === "active");

  return { activePhase, phases, progress };
}
