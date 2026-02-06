"use client";

import { type PhaseStatus } from "@/lib/generation-phases";
import { type ChapterWorkflowStepName } from "@/workflows/config";
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
  completedSteps: ChapterWorkflowStepName[],
  currentStep: ChapterWorkflowStepName | null,
) {
  const t = useExtracted();

  const labels: Record<PhaseName, string> = {
    creatingImages: t("Creating images"),
    figuringOutApproach: t("Figuring out the best approach"),
    finishing: t("Almost done"),
    preparingLessons: t("Preparing lessons"),
    preparingVisuals: t("Preparing illustrations"),
    settingUpActivities: t("Setting up activities"),
    writingContent: t("Writing the content"),
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
