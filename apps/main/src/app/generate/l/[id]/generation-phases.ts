import {
  type AssertAllCovered,
  type PhaseStatus,
  calculateWeightedProgress as calculateProgress,
  calculateTargetProgress as calculateTarget,
  getPhaseStatus as getStatus,
} from "@/lib/generation-phases";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import {
  BookOpenIcon,
  CheckCircleIcon,
  type LucideIcon,
  SearchIcon,
  SparklesIcon,
} from "lucide-react";

export type PhaseName = "gettingStarted" | "creatingContent" | "savingContent" | "finishing";

const PHASE_STEPS = {
  creatingContent: [
    "generateExplanationContent",
    "generateImagePrompts",
    "generateStepImages",
    "generateTutorialContent",
    "generatePracticeContent",
    "generateQuizContent",
    "generateQuizImages",
    "generateVocabularyContent",
    "generateVocabularyDistractors",
    "generateVocabularyPronunciation",
    "generateVocabularyAudio",
    "generateVocabularyRomanization",
    "generateReadingContent",
    "generateReadingAudio",
    "generateReadingRomanization",
    "generateSentenceDistractors",
    "generateSentenceWordMetadata",
    "generateSentenceWordAudio",
    "generateSentenceWordPronunciation",
    "generateGrammarContent",
    "generateGrammarUserContent",
    "generateGrammarRomanization",
  ],
  finishing: ["setLessonAsCompleted"],
  gettingStarted: ["getLesson", "setLessonAsRunning"],
  savingContent: [
    "saveExplanationLesson",
    "saveTutorialLesson",
    "savePracticeLesson",
    "saveQuizLesson",
    "saveVocabularyLesson",
    "saveTranslationLesson",
    "saveReadingLesson",
    "saveListeningLesson",
    "saveGrammarLesson",
  ],
} as const satisfies Record<PhaseName, readonly LessonStepName[]>;

// Compile-time check: typecheck fails with the exact missing step names.
type _ValidateLesson = AssertAllCovered<
  Exclude<LessonStepName, (typeof PHASE_STEPS)[PhaseName][number]>
>;

export const PHASE_ORDER: PhaseName[] = [
  "gettingStarted",
  "creatingContent",
  "savingContent",
  "finishing",
];

export const PHASE_ICONS: Record<PhaseName, LucideIcon> = {
  creatingContent: SparklesIcon,
  finishing: CheckCircleIcon,
  gettingStarted: BookOpenIcon,
  savingContent: SearchIcon,
};

const PHASE_WEIGHTS: Record<PhaseName, number> = {
  creatingContent: 80,
  finishing: 5,
  gettingStarted: 5,
  savingContent: 10,
};

export function getPhaseStatus(
  phase: PhaseName,
  completedSteps: LessonStepName[],
  currentStep: LessonStepName | null,
  startedSteps?: LessonStepName[],
): PhaseStatus {
  return getStatus(phase, completedSteps, currentStep, PHASE_STEPS, startedSteps);
}

const PROGRESS_CONFIG = {
  phaseOrder: PHASE_ORDER,
  phaseSteps: PHASE_STEPS,
  phaseWeights: PHASE_WEIGHTS,
};

export function calculateWeightedProgress(
  completedSteps: LessonStepName[],
  currentStep: LessonStepName | null,
  startedSteps?: LessonStepName[],
): number {
  return calculateProgress(completedSteps, currentStep, { ...PROGRESS_CONFIG, startedSteps });
}

export function calculateTargetProgress(
  completedSteps: LessonStepName[],
  currentStep: LessonStepName | null,
  startedSteps?: LessonStepName[],
): number {
  return calculateTarget(completedSteps, currentStep, { ...PROGRESS_CONFIG, startedSteps });
}
