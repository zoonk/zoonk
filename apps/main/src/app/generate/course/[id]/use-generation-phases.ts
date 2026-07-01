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
    categorizingCourse: t("Categorizing your course"),
    checkingCourseIdentity: t("Checking for duplicates"),
    creatingCoverImage: t("Creating the cover image"),
    findingSimilarCourses: t("Finding similar courses"),
    gettingReady: t("Getting started"),
    outliningChapters: t("Writing chapters"),
    preparingCourse: t("Preparing your course"),
    savingCourseInfo: t("Saving your course"),
    writingDescription: t("Writing your course description"),
    writingLandingPage: t("Writing your course page"),
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

  const activePhaseDurationMs = getActivePhaseDurationMs(activePhaseNames);

  const thinkingGenerators: Record<PhaseName, ThinkingMessageGenerator> = {
    categorizingCourse: (index) =>
      cycleMessage([t("Figuring out the right categories..."), t("Tagging your course...")], index),
    checkingCourseIdentity: (index) =>
      cycleMessage(
        [
          t("Comparing nearby courses..."),
          t("Checking whether this course already exists..."),
          t("Avoiding duplicate courses..."),
        ],
        index,
      ),
    creatingCoverImage: (index) =>
      cycleMessage(
        [
          t("Designing the cover..."),
          t("Picking the right look..."),
          t("Adding finishing touches..."),
        ],
        index,
      ),
    findingSimilarCourses: (index) =>
      cycleMessage(
        [
          t("Searching for matching topics..."),
          t("Looking for alternate names..."),
          t("Expanding the course search..."),
        ],
        index,
      ),
    gettingReady: (index) => cycleMessage([t("Getting started...")], index),
    outliningChapters: createCountingGenerator({
      intro: [t("Planning the course structure...")],
      itemTemplate: (num) => t("Writing chapter {number}...", { number: String(num) }),
      reviewMessage: t("Reviewing the overall flow..."),
    }),
    preparingCourse: (index) =>
      cycleMessage([t("Creating the course shell..."), t("Preparing the workspace...")], index),
    savingCourseInfo: (index) =>
      cycleMessage([t("Saving your progress..."), t("Finishing up...")], index),
    writingDescription: (index) =>
      cycleMessage([t("Summarizing what you'll learn..."), t("Writing the overview...")], index),
    writingLandingPage: (index) =>
      cycleMessage(
        [
          t("Framing why this course is useful..."),
          t("Writing the course page..."),
          t("Shaping the starting point..."),
        ],
        index,
      ),
  };

  return {
    activePhaseDurationMs,
    activePhaseNames,
    phases,
    progress,
    targetProgress,
    thinkingGenerators,
  };
}
