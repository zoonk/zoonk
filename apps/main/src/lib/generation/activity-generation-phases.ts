import {
  type PhaseStatus,
  calculateWeightedProgress as calculateProgress,
  getPhaseStatus as getStatus,
} from "@/lib/generation-phases";
import {
  type FirstActivityKind,
  type PhaseName,
  getPhaseOrder,
  getPhaseSteps,
  getPhaseWeights,
  inferFirstActivityKind,
} from "@/lib/generation/activity-generation-phase-config";
import { type ActivityStepName } from "@/lib/workflow/config";
import { type ActivityKind } from "@zoonk/db";
import {
  AudioLinesIcon,
  BookOpenIcon,
  BookTextIcon,
  CheckCircleIcon,
  ImageIcon,
  LayersIcon,
  type LucideIcon,
  MicIcon,
  PaletteIcon,
  PenLineIcon,
} from "lucide-react";

export type { FirstActivityKind, PhaseName };
export { getPhaseOrder, getPhaseSteps, inferFirstActivityKind };

export const PHASE_ICONS: Record<PhaseName, LucideIcon> = {
  addingPronunciation: MicIcon,
  buildingWordList: BookTextIcon,
  creatingImages: ImageIcon,
  finishing: CheckCircleIcon,
  gettingStarted: BookOpenIcon,
  preparingVisuals: PaletteIcon,
  processingDependencies: LayersIcon,
  recordingAudio: AudioLinesIcon,
  writingContent: PenLineIcon,
};

export function getPhaseStatus(
  phase: PhaseName,
  completedSteps: ActivityStepName[],
  currentStep: ActivityStepName | null,
  activityKind: ActivityKind,
  startedSteps?: ActivityStepName[],
): PhaseStatus {
  return getStatus(phase, completedSteps, currentStep, getPhaseSteps(activityKind), startedSteps);
}

export function calculateWeightedProgress(
  completedSteps: ActivityStepName[],
  currentStep: ActivityStepName | null,
  activityKind: ActivityKind,
  startedSteps?: ActivityStepName[],
): number {
  return calculateProgress(completedSteps, currentStep, {
    phaseOrder: getPhaseOrder(activityKind),
    phaseSteps: getPhaseSteps(activityKind),
    phaseWeights: getPhaseWeights(activityKind),
    startedSteps,
  });
}
