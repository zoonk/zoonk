"use client";

import { type PhaseStatus } from "@/lib/generation-phases";
import { type ActivityStepName } from "@/workflows/config";
import { type ActivityKind } from "@zoonk/db";
import { useExtracted } from "next-intl";
import {
  PHASE_ICONS,
  type PhaseName,
  calculateWeightedProgress,
  getPhaseOrder,
  getPhaseStatus,
} from "./generation-phases";

export type PhaseInfo = {
  name: PhaseName;
  label: string;
  status: PhaseStatus;
  icon: (typeof PHASE_ICONS)[PhaseName];
};

export function useGenerationPhases(
  completedSteps: ActivityStepName[],
  currentStep: ActivityStepName | null,
  activityKind: ActivityKind,
) {
  const t = useExtracted();

  const labels: Record<PhaseName, string> = {
    creatingImages: t("Creating images"),
    finishing: t("Almost done"),
    gettingStarted: t("Getting started"),
    preparingVisuals: t("Preparing illustrations"),
    processingDependencies: t("Processing earlier activities"),
    writingContent: t("Writing the content"),
  };

  const phaseOrder = getPhaseOrder(activityKind);

  const phases: PhaseInfo[] = phaseOrder.map((phase) => ({
    icon: PHASE_ICONS[phase],
    label: labels[phase],
    name: phase,
    status: getPhaseStatus(phase, completedSteps, currentStep, activityKind),
  }));

  const progress = calculateWeightedProgress(completedSteps, currentStep, activityKind);
  const activePhase = phases.find((phase) => phase.status === "active");

  return { activePhase, phases, progress };
}
