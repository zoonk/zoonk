import {
  type PhaseStatus,
  calculateWeightedProgress as calculateProgress,
  calculateTargetProgress as calculateTarget,
  getActivePhaseDurationMs as getDuration,
  getPhaseStatus as getStatus,
} from "@/lib/generation-phases";
import { type CourseWorkflowStepName } from "@zoonk/core/workflows/steps";
import { CheckCircleIcon, LayoutListIcon, type LucideIcon, SearchIcon } from "lucide-react";

export type PhaseName = "findingCourse" | "planningChapters" | "preparingCourse";

const PHASE_STEPS = {
  findingCourse: [
    "getCoursePrompt",
    "generateCourseIdentitySearchQueries",
    "resolveCourseIdentity",
    "initializeCourse",
    "setCourseAsRunning",
  ],
  planningChapters: ["generateChapters"],
  preparingCourse: [
    "generateDescription",
    "generateImage",
    "generateCategories",
    "generateLandingPage",
    "getExistingChapters",
    "updateCourse",
    "addCategories",
    "addChapters",
    "completeCourseSetup",
  ],
} as const satisfies Record<PhaseName, readonly CourseWorkflowStepName[]>;

const PHASE_ORDER: PhaseName[] = ["findingCourse", "planningChapters", "preparingCourse"];

/** All reusable formats prepare a complete curriculum before course-specific setup. */
export function getPhaseOrder(): PhaseName[] {
  return [...PHASE_ORDER];
}

export const PHASE_ICONS: Record<PhaseName, LucideIcon> = {
  findingCourse: SearchIcon,
  planningChapters: LayoutListIcon,
  preparingCourse: CheckCircleIcon,
};

const PHASE_WEIGHTS: Record<PhaseName, number> = {
  findingCourse: 8,
  planningChapters: 120,
  preparingCourse: 20,
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
