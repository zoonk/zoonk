import {
  type PhaseStatus,
  calculateWeightedProgress as calculateProgress,
  getPhaseStatus as getStatus,
} from "@/lib/generation-phases";
import { ACTIVITY_STEPS, type ActivityStepName } from "@/workflows/config";
import {
  BookOpenIcon,
  CheckCircleIcon,
  ImageIcon,
  type LucideIcon,
  SparklesIcon,
} from "lucide-react";

export type PhaseName = "loadingInfo" | "generatingContent" | "generatingVisuals" | "completing";

const PHASE_STEPS: Record<PhaseName, ActivityStepName[]> = {
  completing: [
    "setBackgroundAsCompleted",
    "setExplanationAsCompleted",
    "setMechanicsAsCompleted",
    "setQuizAsCompleted",
  ],
  generatingContent: [
    "generateBackgroundContent",
    "generateExplanationContent",
    "generateMechanicsContent",
    "generateQuizContent",
    "getDependencyContent",
    "notifyDependents",
  ],
  generatingVisuals: [
    "generateVisuals",
    "generateImages",
    "generateQuizImages",
    "saveActivity",
    "saveQuizActivity",
  ],
  loadingInfo: ["getLessonActivities", "setActivityAsRunning"],
};

const allPhaseSteps = new Set(Object.values(PHASE_STEPS).flat());
const missingActivitySteps = ACTIVITY_STEPS.filter((step) => !allPhaseSteps.has(step));

if (missingActivitySteps.length > 0) {
  throw new Error(
    `Missing activity steps in PHASE_STEPS: ${missingActivitySteps.join(", ")}. ` +
      "Add them to the appropriate phase in generation-phases.ts",
  );
}

export const PHASE_ORDER: PhaseName[] = [
  "loadingInfo",
  "generatingContent",
  "generatingVisuals",
  "completing",
];

export const PHASE_ICONS: Record<PhaseName, LucideIcon> = {
  completing: CheckCircleIcon,
  generatingContent: SparklesIcon,
  generatingVisuals: ImageIcon,
  loadingInfo: BookOpenIcon,
};

const PHASE_WEIGHTS: Record<PhaseName, number> = {
  completing: 5,
  generatingContent: 30,
  generatingVisuals: 60,
  loadingInfo: 5,
};

export function getPhaseStatus(
  phase: PhaseName,
  completedSteps: ActivityStepName[],
  currentStep: ActivityStepName | null,
): PhaseStatus {
  return getStatus(phase, completedSteps, currentStep, PHASE_STEPS);
}

export function calculateWeightedProgress(
  completedSteps: ActivityStepName[],
  currentStep: ActivityStepName | null,
): number {
  return calculateProgress(completedSteps, currentStep, {
    phaseOrder: PHASE_ORDER,
    phaseSteps: PHASE_STEPS,
    phaseWeights: PHASE_WEIGHTS,
  });
}
