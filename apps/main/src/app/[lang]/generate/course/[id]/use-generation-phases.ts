"use client";

import { enforcePhaseProgression } from "@/lib/generation-phases";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { useExtracted } from "next-intl";
import {
  PHASE_ICONS,
  type PhaseName,
  calculateTargetProgress,
  calculateWeightedProgress,
  getActivePhaseDurationMs,
  getPhaseOrder,
  getPhaseStatus,
} from "./generation-phases";

export function useGenerationPhases(
  completedSteps: CourseWorkflowStepName[],
  currentStep: CourseWorkflowStepName | null,
  startedSteps?: CourseWorkflowStepName[],
) {
  const t = useExtracted();

  const labels: Record<PhaseName, string> = {
    findingCourse: t("Finding your course"),
    planningChapters: t("Planning your chapters"),
    preparingCourse: t("Getting your course ready"),
  };

  const phases = enforcePhaseProgression(
    getPhaseOrder().map((phase) => ({
      icon: PHASE_ICONS[phase],
      label: labels[phase],
      name: phase,
      status: getPhaseStatus(phase, completedSteps, currentStep, startedSteps),
    })),
  );

  const activePhaseNames = phases
    .filter((phase) => phase.status === "active")
    .map((phase) => phase.name);

  return {
    activePhaseDurationMs: getActivePhaseDurationMs(activePhaseNames),
    phases,
    progress: calculateWeightedProgress(completedSteps, currentStep, startedSteps),
    targetProgress: calculateTargetProgress(completedSteps, currentStep, startedSteps),
  };
}
