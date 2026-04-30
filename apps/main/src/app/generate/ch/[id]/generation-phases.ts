import {
  type AssertAllCovered,
  type PhaseStatus,
  calculateWeightedProgress as calculateProgress,
  calculateTargetProgress as calculateTarget,
  getPhaseStatus as getStatus,
} from "@/lib/generation-phases";
import { type ChapterStepName, type ChapterWorkflowStepName } from "@zoonk/core/workflows/steps";
import {
  BookOpenIcon,
  CheckCircleIcon,
  type LucideIcon,
  SettingsIcon,
  TagsIcon,
} from "lucide-react";

export type PhaseName =
  | "gettingReady"
  | "preparingLessons"
  | "classifyingLessons"
  | "savingLessons";

const PHASE_STEPS = {
  classifyingLessons: ["generateLessonKind"],
  gettingReady: ["getChapter", "setChapterAsRunning"],
  preparingLessons: ["generateLessons"],
  savingLessons: ["addLessons", "setChapterAsCompleted"],
} as const satisfies Record<PhaseName, readonly ChapterStepName[]>;

type AssignedSteps = (typeof PHASE_STEPS)[PhaseName][number];
type _ValidateChapter = AssertAllCovered<Exclude<ChapterStepName, AssignedSteps>>;

const PHASE_ORDER: PhaseName[] = [
  "gettingReady",
  "preparingLessons",
  "classifyingLessons",
  "savingLessons",
];

export function getPhaseOrder(): PhaseName[] {
  return PHASE_ORDER;
}

export const PHASE_ICONS: Record<PhaseName, LucideIcon> = {
  classifyingLessons: TagsIcon,
  gettingReady: SettingsIcon,
  preparingLessons: BookOpenIcon,
  savingLessons: CheckCircleIcon,
};

const PHASE_WEIGHTS: Record<PhaseName, number> = {
  classifyingLessons: 15,
  gettingReady: 5,
  preparingLessons: 70,
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
