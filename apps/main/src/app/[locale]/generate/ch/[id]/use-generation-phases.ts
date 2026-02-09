"use client";

import { type PhaseStatus } from "@/lib/generation-phases";
import { type ChapterWorkflowStepName } from "@/workflows/config";
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
  completedSteps: ChapterWorkflowStepName[],
  currentStep: ChapterWorkflowStepName | null,
  targetLanguage: string | null,
) {
  const t = useExtracted();

  const labels: Record<PhaseName, string> = {
    addingPronunciation: t("Adding pronunciation"),
    buildingWordList: t("Preparing practice content"),
    creatingImages: t("Creating images"),
    figuringOutApproach: t("Figuring out the best approach"),
    finishing: t("Almost done"),
    preparingLessons: t("Preparing lessons"),
    preparingVisuals: t("Preparing illustrations"),
    recordingAudio: t("Recording audio"),
    settingUpActivities: t("Setting up activities"),
    writingContent: t("Writing the content"),
  };

  const phaseOrder = getPhaseOrder({ completedSteps, currentStep, targetLanguage });

  const phases: PhaseInfo[] = phaseOrder.map((phase) => ({
    icon: PHASE_ICONS[phase],
    label: labels[phase],
    name: phase,
    status: getPhaseStatus(phase, completedSteps, currentStep, targetLanguage),
  }));

  const progress = calculateWeightedProgress(completedSteps, currentStep, targetLanguage);
  const activePhase = phases.find((phase) => phase.status === "active");

  return { activePhase, phases, progress };
}
