import {
  type AssertAllCovered,
  type PhaseStatus,
  calculateWeightedProgress as calculateProgress,
  getPhaseStatus as getStatus,
} from "@/lib/generation-phases";
import { type LessonStepName } from "@/workflows/config";
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
  | "settingUpActivities"
  | "finishing";

const PHASE_STEPS = {
  figuringOutApproach: ["determineLessonKind", "updateLessonKind"],
  finishing: ["setLessonAsCompleted"],
  gettingStarted: ["getLesson", "setLessonAsRunning"],
  settingUpActivities: ["generateCustomActivities", "addActivities"],
} as const satisfies Record<PhaseName, readonly LessonStepName[]>;

// Compile-time check: typecheck fails with the exact missing step names.
type _ValidateLesson = AssertAllCovered<
  Exclude<LessonStepName, (typeof PHASE_STEPS)[PhaseName][number]>
>;

export const PHASE_ORDER: PhaseName[] = [
  "gettingStarted",
  "figuringOutApproach",
  "settingUpActivities",
  "finishing",
];

export const PHASE_ICONS: Record<PhaseName, LucideIcon> = {
  figuringOutApproach: SearchIcon,
  finishing: CheckCircleIcon,
  gettingStarted: BookOpenIcon,
  settingUpActivities: SparklesIcon,
};

const PHASE_WEIGHTS: Record<PhaseName, number> = {
  figuringOutApproach: 25,
  finishing: 5,
  gettingStarted: 5,
  settingUpActivities: 65,
};

export function getPhaseStatus(
  phase: PhaseName,
  completedSteps: LessonStepName[],
  currentStep: LessonStepName | null,
): PhaseStatus {
  return getStatus(phase, completedSteps, currentStep, PHASE_STEPS);
}

export function calculateWeightedProgress(
  completedSteps: LessonStepName[],
  currentStep: LessonStepName | null,
): number {
  return calculateProgress(completedSteps, currentStep, {
    phaseOrder: PHASE_ORDER,
    phaseSteps: PHASE_STEPS,
    phaseWeights: PHASE_WEIGHTS,
  });
}
