"use client";

import { type PhaseStatus, enforcePhaseProgression } from "@/lib/generation-phases";
import {
  type ThinkingMessageGenerator,
  createCountingGenerator,
  cycleMessage,
} from "@/lib/workflow/use-thinking-messages";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { useExtracted } from "next-intl";
import {
  PHASE_ICONS,
  type PhaseName,
  calculateTargetProgress,
  calculateWeightedProgress,
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
    categorizingCourse: t("Categorizing your course"),
    creatingCoverImage: t("Creating the cover image"),
    gettingReady: t("Getting things ready"),
    outliningChapters: t("Writing chapters"),
    savingCourseInfo: t("Saving your course"),
    writingDescription: t("Writing your course description"),
  };

  const phaseOrder = getPhaseOrder();

  const rawPhases: {
    name: PhaseName;
    label: string;
    status: PhaseStatus;
    icon: (typeof PHASE_ICONS)[PhaseName];
  }[] = phaseOrder.map((phase) => ({
    icon: PHASE_ICONS[phase],
    label: labels[phase],
    name: phase,
    status: getPhaseStatus(phase, completedSteps, currentStep, startedSteps),
  }));

  const phases = enforcePhaseProgression(rawPhases);

  const progress = calculateWeightedProgress(completedSteps, currentStep, startedSteps);
  const targetProgress = calculateTargetProgress(completedSteps, currentStep, startedSteps);

  const activePhaseNames = phases
    .filter((phase) => phase.status === "active")
    .map((phase) => phase.name);

  const thinkingGenerators: Record<PhaseName, ThinkingMessageGenerator> = {
    categorizingCourse: (index) =>
      cycleMessage([t("Figuring out the right categories..."), t("Tagging your course...")], index),
    creatingCoverImage: (index) =>
      cycleMessage(
        [
          t("Designing the cover..."),
          t("Picking the right look..."),
          t("Adding finishing touches..."),
        ],
        index,
      ),
    gettingReady: (index) =>
      cycleMessage([t("Setting things up..."), t("Getting everything ready...")], index),
    outliningChapters: createCountingGenerator({
      intro: [t("Planning the course structure...")],
      itemTemplate: (num) => t("Writing chapter {number}...", { number: String(num) }),
      reviewMessage: t("Reviewing the overall flow..."),
    }),
    savingCourseInfo: (index) =>
      cycleMessage([t("Saving your progress..."), t("Putting it all together...")], index),
    writingDescription: (index) =>
      cycleMessage([t("Summarizing what you'll learn..."), t("Writing the overview...")], index),
  };

  return { activePhaseNames, phases, progress, targetProgress, thinkingGenerators };
}
