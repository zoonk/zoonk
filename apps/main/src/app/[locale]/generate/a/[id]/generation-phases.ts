import {
  type PhaseStatus,
  calculateWeightedProgress as calculateProgress,
  getPhaseStatus as getStatus,
} from "@/lib/generation-phases";
import {
  ACTIVITY_STEPS,
  type ActivityCompletionStep,
  type ActivityStepName,
  getActivityCompletionStep,
} from "@/workflows/config";
import { type ActivityKind } from "@zoonk/db";
import {
  BookOpenIcon,
  CheckCircleIcon,
  ImageIcon,
  type LucideIcon,
  SparklesIcon,
} from "lucide-react";

export type PhaseName = "loadingInfo" | "generatingContent" | "generatingVisuals" | "completing";

const ALL_COMPLETION_STEPS: ActivityCompletionStep[] = [
  "setBackgroundAsCompleted",
  "setExplanationAsCompleted",
  "setMechanicsAsCompleted",
  "setQuizAsCompleted",
];

function getPhaseSteps(activityKind: ActivityKind): Record<PhaseName, ActivityStepName[]> {
  const completionStep = getActivityCompletionStep(activityKind);

  return {
    completing: [completionStep],
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
}

// Verify all ACTIVITY_STEPS are covered (using all completion steps for validation)
const validationPhaseSteps: Record<PhaseName, ActivityStepName[]> = {
  completing: ALL_COMPLETION_STEPS,
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

const allPhaseSteps = new Set(Object.values(validationPhaseSteps).flat());
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
  activityKind: ActivityKind,
): PhaseStatus {
  const phaseSteps = getPhaseSteps(activityKind);
  return getStatus(phase, completedSteps, currentStep, phaseSteps);
}

export function calculateWeightedProgress(
  completedSteps: ActivityStepName[],
  currentStep: ActivityStepName | null,
  activityKind: ActivityKind,
): number {
  const phaseSteps = getPhaseSteps(activityKind);
  return calculateProgress(completedSteps, currentStep, {
    phaseOrder: PHASE_ORDER,
    phaseSteps,
    phaseWeights: PHASE_WEIGHTS,
  });
}
