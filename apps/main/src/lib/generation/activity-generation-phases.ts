import {
  type PhaseStatus,
  calculateWeightedProgress as calculateProgress,
  calculateTargetProgress as calculateTarget,
  getPhaseStatus as getStatus,
} from "@/lib/generation-phases";
import {
  type PhaseName,
  getPhaseOrder,
  getPhaseSteps,
  getPhaseWeights,
} from "@/lib/generation/activity-generation-phase-config";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { type ActivityKind } from "@zoonk/db";
import {
  AudioLinesIcon,
  BookOpenIcon,
  BookTextIcon,
  CheckCircleIcon,
  GraduationCapIcon,
  ImageIcon,
  LanguagesIcon,
  ListChecksIcon,
  type LucideIcon,
  MicIcon,
  PenLineIcon,
  SearchIcon,
  TextIcon,
} from "lucide-react";

export const PHASE_ICONS: Record<PhaseName, LucideIcon> = {
  addingGrammarRomanization: LanguagesIcon,
  addingPronunciation: MicIcon,
  addingRomanization: LanguagesIcon,
  addingVocabularyRomanization: LanguagesIcon,
  addingWordPronunciation: MicIcon,
  buildingWordList: BookTextIcon,
  creatingAnswerOptions: ListChecksIcon,
  creatingExercises: GraduationCapIcon,
  creatingImages: ImageIcon,
  creatingSentences: TextIcon,
  gettingStarted: BookOpenIcon,
  lookingUpWords: SearchIcon,
  preparingImages: ImageIcon,
  recordingAudio: AudioLinesIcon,
  recordingVocabularyAudio: AudioLinesIcon,
  recordingWordAudio: AudioLinesIcon,
  saving: CheckCircleIcon,
  savingPrerequisites: CheckCircleIcon,
  writingContent: PenLineIcon,
  writingExplanation: PenLineIcon,
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

function getProgressConfig(activityKind: ActivityKind, startedSteps?: ActivityStepName[]) {
  return {
    phaseOrder: getPhaseOrder(activityKind),
    phaseSteps: getPhaseSteps(activityKind),
    phaseWeights: getPhaseWeights(activityKind),
    startedSteps,
  };
}

export function calculateWeightedProgress(
  completedSteps: ActivityStepName[],
  currentStep: ActivityStepName | null,
  activityKind: ActivityKind,
  startedSteps?: ActivityStepName[],
): number {
  return calculateProgress(
    completedSteps,
    currentStep,
    getProgressConfig(activityKind, startedSteps),
  );
}

export function calculateTargetProgress(
  completedSteps: ActivityStepName[],
  currentStep: ActivityStepName | null,
  activityKind: ActivityKind,
  startedSteps?: ActivityStepName[],
): number {
  return calculateTarget(
    completedSteps,
    currentStep,
    getProgressConfig(activityKind, startedSteps),
  );
}
