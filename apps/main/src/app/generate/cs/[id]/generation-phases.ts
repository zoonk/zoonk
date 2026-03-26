import {
  type AssertAllCovered,
  type PhaseStatus,
  calculateWeightedProgress as calculateProgress,
  getPhaseStatus as getStatus,
} from "@/lib/generation-phases";
import { type CourseStepName, type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import {
  ImageIcon,
  LayoutListIcon,
  type LucideIcon,
  PenLineIcon,
  SaveIcon,
  SettingsIcon,
  TagIcon,
} from "lucide-react";

export type PhaseName =
  | "gettingReady"
  | "writingDescription"
  | "creatingCoverImage"
  | "categorizingCourse"
  | "outliningChapters"
  | "savingCourseInfo";

const PHASE_STEPS = {
  categorizingCourse: ["generateAlternativeTitles", "generateCategories"],
  creatingCoverImage: ["generateImage"],
  gettingReady: [
    "getCourseSuggestion",
    "checkExistingCourse",
    "initializeCourse",
    "setCourseAsRunning",
  ],
  outliningChapters: ["generateChapters"],
  savingCourseInfo: [
    "getExistingChapters",
    "updateCourse",
    "addAlternativeTitles",
    "addCategories",
    "addChapters",
    "completeCourseSetup",
  ],
  writingDescription: ["generateDescription"],
} as const satisfies Record<PhaseName, readonly CourseStepName[]>;

type AssignedSteps = (typeof PHASE_STEPS)[PhaseName][number];
type _ValidateCourse = AssertAllCovered<Exclude<CourseStepName, AssignedSteps>>;

const PHASE_ORDER: PhaseName[] = [
  "gettingReady",
  "writingDescription",
  "creatingCoverImage",
  "categorizingCourse",
  "outliningChapters",
  "savingCourseInfo",
];

export function getPhaseOrder(): PhaseName[] {
  return PHASE_ORDER;
}

export const PHASE_ICONS: Record<PhaseName, LucideIcon> = {
  categorizingCourse: TagIcon,
  creatingCoverImage: ImageIcon,
  gettingReady: SettingsIcon,
  outliningChapters: LayoutListIcon,
  savingCourseInfo: SaveIcon,
  writingDescription: PenLineIcon,
};

const PHASE_WEIGHTS: Record<PhaseName, number> = {
  categorizingCourse: 3,
  creatingCoverImage: 7,
  gettingReady: 1,
  outliningChapters: 19,
  savingCourseInfo: 1,
  writingDescription: 3,
};

export function getPhaseStatus(
  phase: PhaseName,
  completedSteps: CourseWorkflowStepName[],
  currentStep: CourseWorkflowStepName | null,
  startedSteps?: CourseWorkflowStepName[],
): PhaseStatus {
  return getStatus(phase, completedSteps, currentStep, PHASE_STEPS, startedSteps);
}

export function calculateWeightedProgress(
  completedSteps: CourseWorkflowStepName[],
  currentStep: CourseWorkflowStepName | null,
  startedSteps?: CourseWorkflowStepName[],
): number {
  return calculateProgress(completedSteps, currentStep, {
    phaseOrder: PHASE_ORDER,
    phaseSteps: PHASE_STEPS,
    phaseWeights: PHASE_WEIGHTS,
    startedSteps,
  });
}
