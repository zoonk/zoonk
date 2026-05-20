import {
  type AssertAllCovered,
  type PhaseStatus,
  calculateWeightedProgress as calculateProgress,
  calculateTargetProgress as calculateTarget,
  getActivePhaseDurationMs as getDuration,
  getPhaseStatus as getStatus,
} from "@/lib/generation-phases";
import { type CourseStepName, type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import {
  CheckCircleIcon,
  ImageIcon,
  LayoutListIcon,
  type LucideIcon,
  PenLineIcon,
  SearchIcon,
  SettingsIcon,
  TagIcon,
} from "lucide-react";

export type PhaseName =
  | "gettingReady"
  | "findingSimilarCourses"
  | "checkingCourseIdentity"
  | "preparingCourse"
  | "writingDescription"
  | "creatingCoverImage"
  | "categorizingCourse"
  | "outliningChapters"
  | "savingCourseInfo";

const PHASE_STEPS = {
  categorizingCourse: ["generateCategories"],
  checkingCourseIdentity: ["resolveCourseIdentity"],
  creatingCoverImage: ["generateImage"],
  findingSimilarCourses: ["generateCourseIdentitySearchQueries"],
  gettingReady: ["getCourseSuggestion"],
  outliningChapters: ["generateChapters"],
  preparingCourse: ["initializeCourse", "setCourseAsRunning"],
  savingCourseInfo: [
    "getExistingChapters",
    "updateCourse",
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
  "findingSimilarCourses",
  "checkingCourseIdentity",
  "preparingCourse",
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
  checkingCourseIdentity: CheckCircleIcon,
  creatingCoverImage: ImageIcon,
  findingSimilarCourses: SearchIcon,
  gettingReady: SettingsIcon,
  outliningChapters: LayoutListIcon,
  preparingCourse: SettingsIcon,
  savingCourseInfo: CheckCircleIcon,
  writingDescription: PenLineIcon,
};

const PHASE_WEIGHTS: Record<PhaseName, number> = {
  categorizingCourse: 2,
  checkingCourseIdentity: 2,
  creatingCoverImage: 20,
  findingSimilarCourses: 2,
  gettingReady: 1,
  outliningChapters: 102,
  preparingCourse: 1,
  savingCourseInfo: 1,
  writingDescription: 4,
};

export function getActivePhaseDurationMs(activePhaseNames: PhaseName[]): number | undefined {
  return getDuration({ activePhases: activePhaseNames, phaseWeights: PHASE_WEIGHTS });
}

export function getPhaseStatus(
  phase: PhaseName,
  completedSteps: CourseWorkflowStepName[],
  currentStep: CourseWorkflowStepName | null,
  startedSteps?: CourseWorkflowStepName[],
): PhaseStatus {
  return getStatus(phase, completedSteps, currentStep, PHASE_STEPS, startedSteps);
}

const PROGRESS_CONFIG = {
  phaseOrder: PHASE_ORDER,
  phaseSteps: PHASE_STEPS,
  phaseWeights: PHASE_WEIGHTS,
};

export function calculateWeightedProgress(
  completedSteps: CourseWorkflowStepName[],
  currentStep: CourseWorkflowStepName | null,
  startedSteps?: CourseWorkflowStepName[],
): number {
  return calculateProgress(completedSteps, currentStep, { ...PROGRESS_CONFIG, startedSteps });
}

export function calculateTargetProgress(
  completedSteps: CourseWorkflowStepName[],
  currentStep: CourseWorkflowStepName | null,
  startedSteps?: CourseWorkflowStepName[],
): number {
  return calculateTarget(completedSteps, currentStep, { ...PROGRESS_CONFIG, startedSteps });
}
