import type { LucideIcon } from "lucide-react";
import { BookOpenIcon, CheckCircleIcon, GraduationCapIcon } from "lucide-react";
import {
  calculateWeightedProgress as calculateProgress,
  getPhaseStatus as getStatus,
  type PhaseStatus,
} from "@/lib/generation-phases";
import type { StepName } from "@/workflows/chapter-generation/types";

export type PhaseName = "loadingInfo" | "generatingLessons" | "completing";

const PHASE_STEPS: Record<PhaseName, StepName[]> = {
  completing: ["setChapterAsCompleted"],
  generatingLessons: ["generateLessons", "addLessons"],
  loadingInfo: ["getChapter", "setChapterAsRunning"],
};

export const PHASE_ORDER: PhaseName[] = [
  "loadingInfo",
  "generatingLessons",
  "completing",
];

export const PHASE_ICONS: Record<PhaseName, LucideIcon> = {
  completing: CheckCircleIcon,
  generatingLessons: GraduationCapIcon,
  loadingInfo: BookOpenIcon,
};

const PHASE_WEIGHTS: Record<PhaseName, number> = {
  completing: 5,
  generatingLessons: 90,
  loadingInfo: 5,
};

export function getPhaseStatus(
  phase: PhaseName,
  completedSteps: StepName[],
  currentStep: StepName | null,
): PhaseStatus {
  return getStatus(phase, completedSteps, currentStep, PHASE_STEPS);
}

export function calculateWeightedProgress(
  completedSteps: StepName[],
  currentStep: StepName | null,
): number {
  return calculateProgress(completedSteps, currentStep, {
    phaseOrder: PHASE_ORDER,
    phaseSteps: PHASE_STEPS,
    phaseWeights: PHASE_WEIGHTS,
  });
}
