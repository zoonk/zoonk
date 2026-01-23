"use client";

import { useExtracted } from "next-intl";
import {
  calculateWeightedProgress,
  getPhaseStatus,
  PHASE_ICONS,
  PHASE_ORDER,
  type PhaseName,
} from "./generation-phases";
import type { PhaseStatus } from "@/lib/generation-phases";
import type { CourseWorkflowStepName } from "@/workflows/config";

type PhaseLabels = Record<PhaseName, string>;

export type PhaseInfo = {
  name: PhaseName;
  label: string;
  status: PhaseStatus;
  icon: (typeof PHASE_ICONS)[PhaseName];
};

export function useGenerationPhases(
  completedSteps: CourseWorkflowStepName[],
  currentStep: CourseWorkflowStepName | null,
) {
  const t = useExtracted();

  const labels: PhaseLabels = {
    checkingExisting: t("Checking for existing course"),
    generatingDetails: t("Generating course details"),
    generatingLessons: t("Generating lessons"),
    loadingInfo: t("Loading course information"),
    planningChapters: t("Planning chapters"),
    savingMetadata: t("Saving course metadata"),
    settingUp: t("Setting up course"),
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
