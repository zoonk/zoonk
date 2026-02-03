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

export type PhaseName = "loadingInfo" | "determiningKind" | "generatingActivities" | "completing";

const PHASE_STEPS: Record<PhaseName, LessonStepName[]> = {
  completing: ["setLessonAsCompleted"],
  determiningKind: ["determineLessonKind", "updateLessonKind"],
  generatingActivities: ["generateCustomActivities", "addActivities"],
  loadingInfo: ["getLesson", "setLessonAsRunning"],
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
  "loadingInfo",
  "determiningKind",
  "generatingActivities",
  "completing",
];

export const PHASE_ICONS: Record<PhaseName, LucideIcon> = {
  completing: CheckCircleIcon,
  determiningKind: SearchIcon,
  generatingActivities: SparklesIcon,
  loadingInfo: BookOpenIcon,
};

const PHASE_WEIGHTS: Record<PhaseName, number> = {
  completing: 5,
  determiningKind: 25,
  generatingActivities: 65,
  loadingInfo: 5,
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
