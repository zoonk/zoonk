import type { LucideIcon } from "lucide-react";
import {
  BookOpenIcon,
  GraduationCapIcon,
  LayoutListIcon,
  SaveIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
} from "lucide-react";
import type { StepName } from "@/workflows/course-generation/types";

export type PhaseName =
  | "loadingInfo"
  | "checkingExisting"
  | "settingUp"
  | "generatingDetails"
  | "savingMetadata"
  | "planningChapters"
  | "generatingLessons";

export type PhaseStatus = "pending" | "active" | "completed";

const PHASE_STEPS: Record<PhaseName, StepName[]> = {
  checkingExisting: ["checkExistingCourse"],
  generatingDetails: [
    "generateDescription",
    "generateImage",
    "generateAlternativeTitles",
    "generateCategories",
  ],
  generatingLessons: ["generateLessons", "addLessons"],
  loadingInfo: ["getCourseSuggestion"],
  planningChapters: ["generateChapters", "addChapters", "completeCourseSetup"],
  savingMetadata: ["updateCourse", "addAlternativeTitles", "addCategories"],
  settingUp: ["initializeCourse"],
};

export const PHASE_ORDER: PhaseName[] = [
  "loadingInfo",
  "checkingExisting",
  "settingUp",
  "generatingDetails",
  "savingMetadata",
  "planningChapters",
  "generatingLessons",
];

export const PHASE_ICONS: Record<PhaseName, LucideIcon> = {
  checkingExisting: SearchIcon,
  generatingDetails: SparklesIcon,
  generatingLessons: GraduationCapIcon,
  loadingInfo: BookOpenIcon,
  planningChapters: LayoutListIcon,
  savingMetadata: SaveIcon,
  settingUp: SettingsIcon,
};

// Weighted progress values based on how long each phase typically takes
const PHASE_WEIGHTS: Record<PhaseName, number> = {
  checkingExisting: 5,
  generatingDetails: 25,
  generatingLessons: 30,
  loadingInfo: 5,
  planningChapters: 20,
  savingMetadata: 10,
  settingUp: 5,
};

export function getPhaseStatus(
  phase: PhaseName,
  completedSteps: StepName[],
  currentStep: StepName | null,
): PhaseStatus {
  const phaseSteps = PHASE_STEPS[phase];
  const completedCount = phaseSteps.filter((s) =>
    completedSteps.includes(s),
  ).length;

  if (completedCount === phaseSteps.length) {
    return "completed";
  }

  if (currentStep && phaseSteps.includes(currentStep)) {
    return "active";
  }

  if (completedCount > 0) {
    return "active";
  }

  return "pending";
}

export function calculateWeightedProgress(
  completedSteps: StepName[],
  currentStep: StepName | null,
): number {
  let totalProgress = 0;

  for (const phase of PHASE_ORDER) {
    const status = getPhaseStatus(phase, completedSteps, currentStep);
    const weight = PHASE_WEIGHTS[phase];

    if (status === "completed") {
      totalProgress += weight;
    } else if (status === "active") {
      const phaseSteps = PHASE_STEPS[phase];
      const completedCount = phaseSteps.filter((s) =>
        completedSteps.includes(s),
      ).length;
      const partialProgress = (completedCount / phaseSteps.length) * weight;
      totalProgress += partialProgress;
    }
  }

  return Math.round(totalProgress);
}
