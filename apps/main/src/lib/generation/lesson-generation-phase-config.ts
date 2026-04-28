import { type AssertAllCovered } from "@/lib/generation-phases";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type LessonKind } from "@zoonk/db";
import { EXPLANATION_PHASE_ORDER, EXPLANATION_PHASE_STEPS } from "./phase-kind-steps/explanation";
import { GRAMMAR_PHASE_ORDER, GRAMMAR_PHASE_STEPS } from "./phase-kind-steps/grammar";
import { LISTENING_PHASE_ORDER, LISTENING_PHASE_STEPS } from "./phase-kind-steps/listening";
import { PRACTICE_PHASE_ORDER, PRACTICE_PHASE_STEPS } from "./phase-kind-steps/practice";
import { QUIZ_PHASE_ORDER, QUIZ_PHASE_STEPS } from "./phase-kind-steps/quiz";
import { READING_PHASE_ORDER, READING_PHASE_STEPS } from "./phase-kind-steps/reading";
import { TRANSLATION_PHASE_ORDER, TRANSLATION_PHASE_STEPS } from "./phase-kind-steps/translation";
import { TUTORIAL_PHASE_ORDER, TUTORIAL_PHASE_STEPS } from "./phase-kind-steps/tutorial";
import { VOCABULARY_PHASE_ORDER, VOCABULARY_PHASE_STEPS } from "./phase-kind-steps/vocabulary";

export { getPhaseWeights } from "./lesson-generation-phase-weights";

/**
 * Phase names shown while a lesson is being generated.
 * The same name must represent the same user-visible kind of work everywhere,
 * so a stalled workflow can be discussed using the exact label the learner saw.
 */
export type PhaseName =
  | "gettingStarted"
  | "buildingWordList"
  | "addingPronunciation"
  | "addingRomanization"
  | "addingVocabularyRomanization"
  | "addingGrammarRomanization"
  | "recordingAudio"
  | "recordingVocabularyAudio"
  | "writingContent"
  | "creatingExercises"
  | "creatingAnswerOptions"
  | "creatingSentences"
  | "lookingUpWords"
  | "recordingWordAudio"
  | "addingWordPronunciation"
  | "writingExplanation"
  | "savingPrerequisites"
  | "preparingImages"
  | "creatingImages"
  | "saving";

export type GeneratedLessonKind = Exclude<LessonKind, "review">;

/** Tells generation routes whether a lesson kind has a workflow-owned generation path. */
export function isGeneratedLessonKind(kind: LessonKind): kind is GeneratedLessonKind {
  return kind !== "review";
}

const PHASE_ORDER_MAP: Record<GeneratedLessonKind, PhaseName[]> = {
  alphabet: VOCABULARY_PHASE_ORDER,
  custom: TUTORIAL_PHASE_ORDER,
  explanation: EXPLANATION_PHASE_ORDER,
  grammar: GRAMMAR_PHASE_ORDER,
  listening: LISTENING_PHASE_ORDER,
  practice: PRACTICE_PHASE_ORDER,
  quiz: QUIZ_PHASE_ORDER,
  reading: READING_PHASE_ORDER,
  translation: TRANSLATION_PHASE_ORDER,
  tutorial: TUTORIAL_PHASE_ORDER,
  vocabulary: VOCABULARY_PHASE_ORDER,
};

/** Returns the ordered progress phases for the selected lesson kind. */
export function getPhaseOrder(kind: GeneratedLessonKind): PhaseName[] {
  return PHASE_ORDER_MAP[kind];
}

const EMPTY: readonly LessonStepName[] = [];

/**
 * Builds a complete phase-to-steps map from a kind-specific subset.
 * The shared phase engine expects every phase key to exist, while each lesson
 * kind should list only the workflow steps it actually executes.
 */
function toFullPhaseSteps(
  partial: Record<string, readonly LessonStepName[]>,
): Record<PhaseName, readonly LessonStepName[]> {
  return {
    addingGrammarRomanization: EMPTY,
    addingPronunciation: EMPTY,
    addingRomanization: EMPTY,
    addingVocabularyRomanization: EMPTY,
    addingWordPronunciation: EMPTY,
    buildingWordList: EMPTY,
    creatingAnswerOptions: EMPTY,
    creatingExercises: EMPTY,
    creatingImages: EMPTY,
    creatingSentences: EMPTY,
    gettingStarted: EMPTY,
    lookingUpWords: EMPTY,
    preparingImages: EMPTY,
    recordingAudio: EMPTY,
    recordingVocabularyAudio: EMPTY,
    recordingWordAudio: EMPTY,
    saving: EMPTY,
    savingPrerequisites: EMPTY,
    writingContent: EMPTY,
    writingExplanation: EMPTY,
    ...partial,
  };
}

const PHASE_STEPS_MAP: Record<GeneratedLessonKind, Record<PhaseName, readonly LessonStepName[]>> = {
  alphabet: toFullPhaseSteps(VOCABULARY_PHASE_STEPS),
  custom: toFullPhaseSteps(TUTORIAL_PHASE_STEPS),
  explanation: toFullPhaseSteps(EXPLANATION_PHASE_STEPS),
  grammar: toFullPhaseSteps(GRAMMAR_PHASE_STEPS),
  listening: toFullPhaseSteps(LISTENING_PHASE_STEPS),
  practice: toFullPhaseSteps(PRACTICE_PHASE_STEPS),
  quiz: toFullPhaseSteps(QUIZ_PHASE_STEPS),
  reading: toFullPhaseSteps(READING_PHASE_STEPS),
  translation: toFullPhaseSteps(TRANSLATION_PHASE_STEPS),
  tutorial: toFullPhaseSteps(TUTORIAL_PHASE_STEPS),
  vocabulary: toFullPhaseSteps(VOCABULARY_PHASE_STEPS),
};

/** Returns the phase-to-steps mapping for the selected lesson kind. */
export function getPhaseSteps(
  kind: GeneratedLessonKind,
): Record<PhaseName, readonly LessonStepName[]> {
  return PHASE_STEPS_MAP[kind];
}

type AssignedLessonStep =
  | (typeof EXPLANATION_PHASE_STEPS)[keyof typeof EXPLANATION_PHASE_STEPS][number]
  | (typeof GRAMMAR_PHASE_STEPS)[keyof typeof GRAMMAR_PHASE_STEPS][number]
  | (typeof LISTENING_PHASE_STEPS)[keyof typeof LISTENING_PHASE_STEPS][number]
  | (typeof PRACTICE_PHASE_STEPS)[keyof typeof PRACTICE_PHASE_STEPS][number]
  | (typeof QUIZ_PHASE_STEPS)[keyof typeof QUIZ_PHASE_STEPS][number]
  | (typeof READING_PHASE_STEPS)[keyof typeof READING_PHASE_STEPS][number]
  | (typeof TRANSLATION_PHASE_STEPS)[keyof typeof TRANSLATION_PHASE_STEPS][number]
  | (typeof TUTORIAL_PHASE_STEPS)[keyof typeof TUTORIAL_PHASE_STEPS][number]
  | (typeof VOCABULARY_PHASE_STEPS)[keyof typeof VOCABULARY_PHASE_STEPS][number];

type _ValidateLesson = AssertAllCovered<Exclude<LessonStepName, AssignedLessonStep>>;
