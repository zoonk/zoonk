import {
  type AssertAllCovered,
  type PhaseStatus,
  calculateWeightedProgress as calculateProgress,
  calculateTargetProgress as calculateTarget,
  getPhaseStatus as getStatus,
} from "@/lib/generation-phases";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import {
  BookOpenIcon,
  CheckCircleIcon,
  type LucideIcon,
  SearchIcon,
  SparklesIcon,
} from "lucide-react";

export type PhaseName =
  | "gettingStarted"
  | "figuringOutApproach"
  | "personalizingLesson"
  | "settingUpActivities"
  | "finishing";

const PHASE_STEPS = {
  figuringOutApproach: ["determineLessonKind", "updateLessonKind", "removeNonLanguageLesson"],
  finishing: ["setLessonAsCompleted"],
  gettingStarted: ["getLesson", "setLessonAsRunning"],
  personalizingLesson: ["determineAppliedActivity"],
  settingUpActivities: ["generateCustomActivities", "addActivities"],
} as const satisfies Record<PhaseName, readonly LessonStepName[]>;

// Compile-time check: typecheck fails with the exact missing step names.
type _ValidateLesson = AssertAllCovered<
  Exclude<LessonStepName, (typeof PHASE_STEPS)[PhaseName][number]>
>;

export const PHASE_ORDER: PhaseName[] = [
  "gettingStarted",
  "figuringOutApproach",
  "personalizingLesson",
  "settingUpActivities",
  "finishing",
];

export const PHASE_ICONS: Record<PhaseName, LucideIcon> = {
  figuringOutApproach: SearchIcon,
  finishing: CheckCircleIcon,
  gettingStarted: BookOpenIcon,
  personalizingLesson: SparklesIcon,
  settingUpActivities: SparklesIcon,
};

const PHASE_WEIGHTS: Record<PhaseName, number> = {
  figuringOutApproach: 20,
  finishing: 5,
  gettingStarted: 5,
  personalizingLesson: 20,
  settingUpActivities: 50,
};

export function getPhaseStatus(
  phase: PhaseName,
  completedSteps: LessonStepName[],
  currentStep: LessonStepName | null,
  startedSteps?: LessonStepName[],
): PhaseStatus {
  return getStatus(phase, completedSteps, currentStep, PHASE_STEPS, startedSteps);
}

const PROGRESS_CONFIG = {
  phaseOrder: PHASE_ORDER,
  phaseSteps: PHASE_STEPS,
  phaseWeights: PHASE_WEIGHTS,
};

export function calculateWeightedProgress(
  completedSteps: LessonStepName[],
  currentStep: LessonStepName | null,
  startedSteps?: LessonStepName[],
): number {
  return calculateProgress(completedSteps, currentStep, { ...PROGRESS_CONFIG, startedSteps });
}

export function calculateTargetProgress(
  completedSteps: LessonStepName[],
  currentStep: LessonStepName | null,
  startedSteps?: LessonStepName[],
): number {
  return calculateTarget(completedSteps, currentStep, { ...PROGRESS_CONFIG, startedSteps });
}
