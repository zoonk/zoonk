import {
  type PhaseStatus,
  calculateWeightedProgress as calculateProgress,
  getPhaseStatus as getStatus,
} from "@/lib/generation-phases";
import { CHAPTER_STEPS, type ChapterWorkflowStepName, LESSON_STEPS } from "@/workflows/config";
import {
  BookOpenIcon,
  CheckCircleIcon,
  GraduationCapIcon,
  type LucideIcon,
  SparklesIcon,
} from "lucide-react";

export type PhaseName = "loadingInfo" | "generatingLessons" | "generatingActivities" | "completing";

const PHASE_STEPS: Record<PhaseName, ChapterWorkflowStepName[]> = {
  completing: ["setChapterAsCompleted"],
  generatingActivities: [...LESSON_STEPS],
  generatingLessons: ["generateLessons", "addLessons"],
  loadingInfo: ["getChapter", "setChapterAsRunning"],
};

const allPhaseSteps = new Set(Object.values(PHASE_STEPS).flat());
const missingChapterSteps = CHAPTER_STEPS.filter((step) => !allPhaseSteps.has(step));

if (missingChapterSteps.length > 0) {
  throw new Error(
    `Missing chapter steps in PHASE_STEPS: ${missingChapterSteps.join(", ")}. ` +
      "Add them to the appropriate phase in generation-phases.ts",
  );
}

export const PHASE_ORDER: PhaseName[] = [
  "loadingInfo",
  "generatingLessons",
  "generatingActivities",
  "completing",
];

export const PHASE_ICONS: Record<PhaseName, LucideIcon> = {
  completing: CheckCircleIcon,
  generatingActivities: SparklesIcon,
  generatingLessons: GraduationCapIcon,
  loadingInfo: BookOpenIcon,
};

const PHASE_WEIGHTS: Record<PhaseName, number> = {
  completing: 5,
  generatingActivities: 45,
  generatingLessons: 45,
  loadingInfo: 5,
};

export function getPhaseStatus(
  phase: PhaseName,
  completedSteps: ChapterWorkflowStepName[],
  currentStep: ChapterWorkflowStepName | null,
): PhaseStatus {
  return getStatus(phase, completedSteps, currentStep, PHASE_STEPS);
}

export function calculateWeightedProgress(
  completedSteps: ChapterWorkflowStepName[],
  currentStep: ChapterWorkflowStepName | null,
): number {
  return calculateProgress(completedSteps, currentStep, {
    phaseOrder: PHASE_ORDER,
    phaseSteps: PHASE_STEPS,
    phaseWeights: PHASE_WEIGHTS,
  });
}
