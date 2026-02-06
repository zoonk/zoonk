import {
  type PhaseStatus,
  calculateWeightedProgress as calculateProgress,
  getPhaseStatus as getStatus,
} from "@/lib/generation-phases";
import { LESSON_STEPS, type LessonStepName } from "@/workflows/config";
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

const PHASE_STEPS: Record<PhaseName, LessonStepName[]> = {
  figuringOutApproach: ["determineLessonKind", "updateLessonKind"],
  finishing: ["setLessonAsCompleted"],
  gettingStarted: ["getLesson", "setLessonAsRunning"],
  settingUpActivities: ["generateCustomActivities", "addActivities"],
};

const allPhaseSteps = new Set(Object.values(PHASE_STEPS).flat());
const missingLessonSteps = LESSON_STEPS.filter((step) => !allPhaseSteps.has(step));

if (missingLessonSteps.length > 0) {
  throw new Error(
    `Missing lesson steps in PHASE_STEPS: ${missingLessonSteps.join(", ")}. ` +
      "Add them to the appropriate phase in generation-phases.ts",
  );
}

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
