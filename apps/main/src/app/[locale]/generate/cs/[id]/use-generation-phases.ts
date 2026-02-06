"use client";

import { type PhaseStatus } from "@/lib/generation-phases";
import { type CourseWorkflowStepName } from "@/workflows/config";
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
  completedSteps: CourseWorkflowStepName[],
  currentStep: CourseWorkflowStepName | null,
) {
  const t = useExtracted();

  const labels: Record<PhaseName, string> = {
    categorizingCourse: t("Categorizing your course"),
    creatingCoverImage: t("Creating the cover image"),
    creatingImages: t("Creating images"),
    figuringOutApproach: t("Figuring out the best approach"),
    finishing: t("Almost done"),
    gettingReady: t("Getting things ready"),
    outliningChapters: t("Outlining chapters"),
    planningLessons: t("Planning your first lesson"),
    preparingVisuals: t("Preparing illustrations"),
    savingCourseInfo: t("Saving your course"),
    settingUpActivities: t("Setting up activities"),
    writingContent: t("Writing the lesson content"),
    writingDescription: t("Writing your course description"),
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
