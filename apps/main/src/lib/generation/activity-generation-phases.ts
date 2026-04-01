import {
  type PhaseStatus,
  calculateWeightedProgress as calculateProgress,
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
  PaletteIcon,
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
  buildingScenario: BookOpenIcon,
  buildingWordList: BookTextIcon,
  creatingAnswerOptions: ListChecksIcon,
  creatingExercises: GraduationCapIcon,
  creatingImages: ImageIcon,
  creatingSentences: TextIcon,
  gettingStarted: BookOpenIcon,
  lookingUpWords: SearchIcon,
  preparingVisuals: PaletteIcon,
  recordingAudio: AudioLinesIcon,
  recordingVocabularyAudio: AudioLinesIcon,
  recordingWordAudio: AudioLinesIcon,
  saving: CheckCircleIcon,
  savingPrerequisites: CheckCircleIcon,
  writingContent: PenLineIcon,
  writingDebrief: PenLineIcon,
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
