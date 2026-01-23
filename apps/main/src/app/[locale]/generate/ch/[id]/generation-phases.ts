import {
  type PhaseStatus,
  calculateWeightedProgress as calculateProgress,
  getPhaseStatus as getStatus,
} from "@/lib/generation-phases";
import { BookOpenIcon, CheckCircleIcon, GraduationCapIcon, type LucideIcon } from "lucide-react";
import type { ChapterStepName } from "@/workflows/config";

export type PhaseName = "loadingInfo" | "generatingLessons" | "completing";

const PHASE_STEPS: Record<PhaseName, ChapterStepName[]> = {
  completing: ["setChapterAsCompleted"],
  generatingLessons: ["generateLessons", "addLessons"],
  loadingInfo: ["getChapter", "setChapterAsRunning"],
};

export const PHASE_ORDER: PhaseName[] = ["loadingInfo", "generatingLessons", "completing"];

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
  completedSteps: ChapterStepName[],
  currentStep: ChapterStepName | null,
): PhaseStatus {
  return getStatus(phase, completedSteps, currentStep, PHASE_STEPS);
}

export function calculateWeightedProgress(
  completedSteps: ChapterStepName[],
  currentStep: ChapterStepName | null,
): number {
  return calculateProgress(completedSteps, currentStep, {
    phaseOrder: PHASE_ORDER,
    phaseSteps: PHASE_STEPS,
    phaseWeights: PHASE_WEIGHTS,
  });
}
