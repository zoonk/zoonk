import {
  type PhaseStatus,
  calculateWeightedProgress as calculateProgress,
  calculateTargetProgress as calculateTarget,
  getActivePhaseDurationMs as getDuration,
  getPhaseStatus as getStatus,
} from "@/lib/generation-phases";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
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
import {
  type GeneratedLessonKind,
  type PhaseName,
  getPhaseOrder,
  getPhaseSteps,
  getPhaseWeights,
} from "./generation-phase-config";

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
  creatingLessonImage: ImageIcon,
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

/** Returns a phase status using the step map for the selected lesson kind. */
export function getPhaseStatus(
  phase: PhaseName,
  completedSteps: LessonStepName[],
  currentStep: LessonStepName | null,
  lessonKind: GeneratedLessonKind,
  startedSteps?: LessonStepName[],
): PhaseStatus {
  return getStatus(phase, completedSteps, currentStep, getPhaseSteps(lessonKind), startedSteps);
}

/** Builds the shared progress config for a lesson kind. */
function getProgressConfig(lessonKind: GeneratedLessonKind, startedSteps?: LessonStepName[]) {
  return {
    phaseOrder: getPhaseOrder(lessonKind),
    phaseSteps: getPhaseSteps(lessonKind),
    phaseWeights: getPhaseWeights(lessonKind),
    startedSteps,
  };
}

/** Calculates progress using only the phases that the selected lesson kind executes. */
export function calculateWeightedProgress(
  completedSteps: LessonStepName[],
  currentStep: LessonStepName | null,
  lessonKind: GeneratedLessonKind,
  startedSteps?: LessonStepName[],
): number {
  return calculateProgress(
    completedSteps,
    currentStep,
    getProgressConfig(lessonKind, startedSteps),
  );
}

/** Calculates the progress value that the active lesson phases can animate toward. */
export function calculateTargetProgress(
  completedSteps: LessonStepName[],
  currentStep: LessonStepName | null,
  lessonKind: GeneratedLessonKind,
  startedSteps?: LessonStepName[],
): number {
  return calculateTarget(completedSteps, currentStep, getProgressConfig(lessonKind, startedSteps));
}

/** Returns the longest active lesson phase duration in milliseconds. */
export function getActivePhaseDurationMs(
  activePhaseNames: PhaseName[],
  lessonKind: GeneratedLessonKind,
): number | undefined {
  return getDuration({ activePhases: activePhaseNames, phaseWeights: getPhaseWeights(lessonKind) });
}
