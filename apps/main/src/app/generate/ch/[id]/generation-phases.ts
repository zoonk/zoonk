import {
  type AssertAllCovered,
  type PhaseStatus,
  calculateWeightedProgress as calculateProgress,
  calculateTargetProgress as calculateTarget,
  getPhaseStatus as getStatus,
} from "@/lib/generation-phases";
import { type ChapterStepName, type ChapterWorkflowStepName } from "@zoonk/core/workflows/steps";
import { BookOpenIcon, CheckCircleIcon, type LucideIcon, SettingsIcon } from "lucide-react";

export type PhaseName = "gettingReady" | "preparingLessons" | "savingLessons";

const PHASE_STEPS = {
  gettingReady: ["getChapter", "setChapterAsRunning"],
  preparingLessons: ["generateLessons"],
  savingLessons: ["addLessons", "setChapterAsCompleted"],
} as const satisfies Record<PhaseName, readonly ChapterStepName[]>;

type AssignedSteps = (typeof PHASE_STEPS)[PhaseName][number];
type _ValidateChapter = AssertAllCovered<Exclude<ChapterStepName, AssignedSteps>>;

const PHASE_ORDER: PhaseName[] = ["gettingReady", "preparingLessons", "savingLessons"];

export function getPhaseOrder(): PhaseName[] {
  return PHASE_ORDER;
}

export const PHASE_ICONS: Record<PhaseName, LucideIcon> = {
  gettingReady: SettingsIcon,
  preparingLessons: BookOpenIcon,
  savingLessons: CheckCircleIcon,
};

const PHASE_WEIGHTS: Record<PhaseName, number> = {
  gettingReady: 5,
  preparingLessons: 85,
  savingLessons: 10,
};

export function getPhaseStatus(
  phase: PhaseName,
  completedSteps: ChapterWorkflowStepName[],
  currentStep: ChapterWorkflowStepName | null,
  startedSteps?: ChapterWorkflowStepName[],
): PhaseStatus {
  return getStatus(phase, completedSteps, currentStep, PHASE_STEPS, startedSteps);
}

const PROGRESS_CONFIG = {
  phaseOrder: PHASE_ORDER,
  phaseSteps: PHASE_STEPS,
  phaseWeights: PHASE_WEIGHTS,
};

export function calculateWeightedProgress(
  completedSteps: ChapterWorkflowStepName[],
  currentStep: ChapterWorkflowStepName | null,
  startedSteps?: ChapterWorkflowStepName[],
): number {
  return calculateProgress(completedSteps, currentStep, { ...PROGRESS_CONFIG, startedSteps });
}

export function calculateTargetProgress(
  completedSteps: ChapterWorkflowStepName[],
  currentStep: ChapterWorkflowStepName | null,
  startedSteps?: ChapterWorkflowStepName[],
): number {
  return calculateTarget(completedSteps, currentStep, { ...PROGRESS_CONFIG, startedSteps });
}
