import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { type ActivityKind } from "@zoonk/db";
import { CUSTOM_PHASE_ORDER, CUSTOM_PHASE_STEPS } from "./phase-kind-steps/custom";
import { EXPLANATION_PHASE_ORDER, EXPLANATION_PHASE_STEPS } from "./phase-kind-steps/explanation";
import { GRAMMAR_PHASE_ORDER, GRAMMAR_PHASE_STEPS } from "./phase-kind-steps/grammar";
import { LISTENING_PHASE_ORDER, LISTENING_PHASE_STEPS } from "./phase-kind-steps/listening";
import { PRACTICE_PHASE_ORDER, PRACTICE_PHASE_STEPS } from "./phase-kind-steps/practice";
import { QUIZ_PHASE_ORDER, QUIZ_PHASE_STEPS } from "./phase-kind-steps/quiz";
import { READING_PHASE_ORDER, READING_PHASE_STEPS } from "./phase-kind-steps/reading";
import { VOCABULARY_PHASE_ORDER, VOCABULARY_PHASE_STEPS } from "./phase-kind-steps/vocabulary";

export { getPhaseWeights } from "./activity-generation-phase-weights";

/**
 * PHASE GROUPING RULES
 *
 * Phases are progress indicators shown to users during content generation.
 * Each phase transition is a visual "tick" telling the user something happened.
 *
 * 1. ONE AI/TTS CALL PER PHASE — AI and TTS calls are slow. Each one gets
 *    its own phase so users see progress movement. Never group multiple
 *    AI/TTS calls into the same phase.
 *
 * 2. DB STEPS CAN BE GROUPED — Database reads and writes are fast (milliseconds).
 *    Group them into "gettingStarted" (setup) and "saving" (final write).
 *
 * 3. ONLY INCLUDE RELEVANT STEPS — Each kind's config only lists steps that
 *    kind actually executes. No filler steps from other kinds.
 *
 * 4. HUMAN-FRIENDLY NAMES — Phase names match what users see in the UI.
 *    Write for humans, not machines. No jargon or technical terms.
 *    If a user reports an issue in a specific phase, both sides should
 *    use the same naming.
 *
 * WHEN ADDING A NEW STEP:
 * 1. Add the step name to ACTIVITY_STEPS in packages/core/src/workflows/steps.ts
 * 2. Add it to the relevant kind's config in phase-kind-steps/{kind}.ts
 * 3. The AssertAllCovered type will error if you forget to assign it to a phase
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

const PHASE_ORDER_MAP: Record<ActivityKind, PhaseName[]> = {
  custom: CUSTOM_PHASE_ORDER,
  explanation: EXPLANATION_PHASE_ORDER,
  grammar: GRAMMAR_PHASE_ORDER,
  listening: LISTENING_PHASE_ORDER,
  practice: PRACTICE_PHASE_ORDER,
  quiz: QUIZ_PHASE_ORDER,
  reading: READING_PHASE_ORDER,
  review: EXPLANATION_PHASE_ORDER,
  translation: VOCABULARY_PHASE_ORDER,
  vocabulary: VOCABULARY_PHASE_ORDER,
};

/** Returns the ordered list of phases for a given activity kind. */
export function getPhaseOrder(kind: ActivityKind): PhaseName[] {
  return PHASE_ORDER_MAP[kind];
}

const EMPTY: readonly ActivityStepName[] = [];

/**
 * Fills a partial phase-to-steps mapping into a full Record<PhaseName, ...>
 * by setting empty arrays for phases the kind doesn't use.
 */
function toFullPhaseSteps(
  partial: Record<string, readonly ActivityStepName[]>,
): Record<PhaseName, readonly ActivityStepName[]> {
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

const PHASE_STEPS_MAP: Record<ActivityKind, Record<PhaseName, readonly ActivityStepName[]>> = {
  custom: toFullPhaseSteps(CUSTOM_PHASE_STEPS),
  explanation: toFullPhaseSteps(EXPLANATION_PHASE_STEPS),
  grammar: toFullPhaseSteps(GRAMMAR_PHASE_STEPS),
  listening: toFullPhaseSteps(LISTENING_PHASE_STEPS),
  practice: toFullPhaseSteps(PRACTICE_PHASE_STEPS),
  quiz: toFullPhaseSteps(QUIZ_PHASE_STEPS),
  reading: toFullPhaseSteps(READING_PHASE_STEPS),
  review: toFullPhaseSteps(EXPLANATION_PHASE_STEPS),
  translation: toFullPhaseSteps(VOCABULARY_PHASE_STEPS),
  vocabulary: toFullPhaseSteps(VOCABULARY_PHASE_STEPS),
};

/** Returns the phase-to-steps mapping for a given activity kind. */
export function getPhaseSteps(kind: ActivityKind): Record<PhaseName, readonly ActivityStepName[]> {
  return PHASE_STEPS_MAP[kind];
}
