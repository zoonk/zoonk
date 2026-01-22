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
import {
  calculateWeightedProgress as calculateProgress,
  getPhaseStatus as getStatus,
  type PhaseStatus,
} from "@/lib/generation-phases";
import { CHAPTER_STEPS, type CourseWorkflowStepName } from "@/workflows/config";

export type PhaseName =
  | "loadingInfo"
  | "checkingExisting"
  | "settingUp"
  | "generatingDetails"
  | "savingMetadata"
  | "planningChapters"
  | "generatingLessons";

const PHASE_STEPS: Record<PhaseName, CourseWorkflowStepName[]> = {
  checkingExisting: ["checkExistingCourse"],
  generatingDetails: [
    "generateDescription",
    "generateImage",
    "generateAlternativeTitles",
    "generateCategories",
  ],
  generatingLessons: [...CHAPTER_STEPS],
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

const PHASE_WEIGHTS: Record<PhaseName, number> = {
  checkingExisting: 1,
  generatingDetails: 19,
  generatingLessons: 38,
  loadingInfo: 1,
  planningChapters: 38,
  savingMetadata: 2,
  settingUp: 1,
};

export function getPhaseStatus(
  phase: PhaseName,
  completedSteps: CourseWorkflowStepName[],
  currentStep: CourseWorkflowStepName | null,
): PhaseStatus {
  return getStatus(phase, completedSteps, currentStep, PHASE_STEPS);
}

export function calculateWeightedProgress(
  completedSteps: CourseWorkflowStepName[],
  currentStep: CourseWorkflowStepName | null,
): number {
  return calculateProgress(completedSteps, currentStep, {
    phaseOrder: PHASE_ORDER,
    phaseSteps: PHASE_STEPS,
    phaseWeights: PHASE_WEIGHTS,
  });
}
