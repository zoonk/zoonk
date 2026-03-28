import { type AssertAllCovered } from "@/lib/generation-phases";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { type PhaseName } from "./activity-generation-phase-config";

/**
 * Per-kind phase step configs.
 *
 * Each kind defines a const object mapping phases to step arrays.
 * The AssertAllCovered type ensures no relevant step is forgotten.
 * Only phases the kind uses are populated — unused phases get empty
 * arrays via toFullPhaseSteps() in the main config file.
 *
 * See activity-generation-phase-config.ts for the phase grouping rules.
 */

// -- Vocabulary / Translation -----------------------------------------------

type VocabularySteps =
  | "getLessonActivities"
  | "getNeighboringConcepts"
  | "setActivityAsRunning"
  | "generateVocabularyContent"
  | "generateVocabularyDistractors"
  | "generateVocabularyPronunciation"
  | "generateVocabularyRomanization"
  | "generateVocabularyAudio"
  | "saveVocabularyActivity";

export const VOCABULARY_PHASE_STEPS = {
  addingPronunciation: ["generateVocabularyPronunciation"],
  addingRomanization: ["generateVocabularyRomanization"],
  buildingWordList: ["generateVocabularyContent"],
  creatingExercises: ["generateVocabularyDistractors"],
  gettingStarted: ["getLessonActivities", "getNeighboringConcepts", "setActivityAsRunning"],
  recordingAudio: ["generateVocabularyAudio"],
  saving: ["saveVocabularyActivity"],
} as const satisfies Record<string, readonly ActivityStepName[]>;

type _ValidateVocabulary = AssertAllCovered<
  Exclude<
    VocabularySteps,
    (typeof VOCABULARY_PHASE_STEPS)[keyof typeof VOCABULARY_PHASE_STEPS][number]
  >
>;

export const VOCABULARY_PHASE_ORDER: PhaseName[] = [
  "gettingStarted",
  "buildingWordList",
  "creatingExercises",
  "addingPronunciation",
  "addingRomanization",
  "recordingAudio",
  "saving",
];

// -- Grammar ----------------------------------------------------------------

type GrammarSteps =
  | "getLessonActivities"
  | "getNeighboringConcepts"
  | "setActivityAsRunning"
  | "generateGrammarContent"
  | "generateGrammarUserContent"
  | "generateGrammarRomanization"
  | "saveGrammarActivity";

export const GRAMMAR_PHASE_STEPS = {
  addingRomanization: ["generateGrammarRomanization"],
  creatingExercises: ["generateGrammarUserContent"],
  gettingStarted: ["getLessonActivities", "getNeighboringConcepts", "setActivityAsRunning"],
  saving: ["saveGrammarActivity"],
  writingContent: ["generateGrammarContent"],
} as const satisfies Record<string, readonly ActivityStepName[]>;

type _ValidateGrammar = AssertAllCovered<
  Exclude<GrammarSteps, (typeof GRAMMAR_PHASE_STEPS)[keyof typeof GRAMMAR_PHASE_STEPS][number]>
>;

export const GRAMMAR_PHASE_ORDER: PhaseName[] = [
  "gettingStarted",
  "writingContent",
  "creatingExercises",
  "addingRomanization",
  "saving",
];

// -- Reading ----------------------------------------------------------------

type ReadingSteps =
  | "getLessonActivities"
  | "getNeighboringConcepts"
  | "setActivityAsRunning"
  | "generateSentences"
  | "generateSentenceDistractors"
  | "generateAudio"
  | "generateReadingRomanization"
  | "generateSentenceWordMetadata"
  | "generateSentenceWordAudio"
  | "generateSentenceWordPronunciation"
  | "saveReadingActivity";

export const READING_PHASE_STEPS = {
  addingRomanization: ["generateReadingRomanization"],
  addingWordPronunciation: ["generateSentenceWordPronunciation"],
  creatingExercises: ["generateSentenceDistractors"],
  creatingSentences: ["generateSentences"],
  gettingStarted: ["getLessonActivities", "getNeighboringConcepts", "setActivityAsRunning"],
  lookingUpWords: ["generateSentenceWordMetadata"],
  recordingAudio: ["generateAudio"],
  recordingWordAudio: ["generateSentenceWordAudio"],
  saving: ["saveReadingActivity"],
} as const satisfies Record<string, readonly ActivityStepName[]>;

type _ValidateReading = AssertAllCovered<
  Exclude<ReadingSteps, (typeof READING_PHASE_STEPS)[keyof typeof READING_PHASE_STEPS][number]>
>;

export const READING_PHASE_ORDER: PhaseName[] = [
  "gettingStarted",
  "creatingSentences",
  "creatingExercises",
  "recordingAudio",
  "addingRomanization",
  "lookingUpWords",
  "recordingWordAudio",
  "addingWordPronunciation",
  "saving",
];

// -- Listening --------------------------------------------------------------
//
// Listening runs the entire language pipeline: vocabulary + grammar in parallel,
// then reading, then copies reading steps for the listening activity.
// Each AI/TTS call gets its own phase. Vocabulary and grammar phases run in
// parallel, so phases may complete out of order — that's fine.
//
// Listening needs its own phase names for romanization and audio because
// it runs vocabulary, grammar, AND reading — the same underlying steps
// (e.g., generateVocabularyRomanization vs generateReadingRomanization)
// need different phases since they're separate AI calls in the same flow.

type ListeningSteps =
  | "getLessonActivities"
  | "getNeighboringConcepts"
  | "setActivityAsRunning"
  | "generateVocabularyContent"
  | "generateVocabularyDistractors"
  | "generateVocabularyPronunciation"
  | "generateVocabularyRomanization"
  | "generateVocabularyAudio"
  | "saveVocabularyActivity"
  | "generateGrammarContent"
  | "generateGrammarUserContent"
  | "generateGrammarRomanization"
  | "saveGrammarActivity"
  | "generateSentences"
  | "generateSentenceDistractors"
  | "generateAudio"
  | "generateReadingRomanization"
  | "generateSentenceWordMetadata"
  | "generateSentenceWordAudio"
  | "generateSentenceWordPronunciation"
  | "saveReadingActivity"
  | "copyListeningSteps"
  | "saveListeningActivity";

export const LISTENING_PHASE_STEPS = {
  addingGrammarRomanization: ["generateGrammarRomanization"],
  addingPronunciation: ["generateVocabularyPronunciation"],
  addingRomanization: ["generateReadingRomanization"],
  addingVocabularyRomanization: ["generateVocabularyRomanization"],
  addingWordPronunciation: ["generateSentenceWordPronunciation"],
  buildingWordList: ["generateVocabularyContent"],
  creatingAnswerOptions: ["generateSentenceDistractors"],
  creatingExercises: ["generateGrammarUserContent", "generateVocabularyDistractors"],
  creatingSentences: ["generateSentences"],
  gettingStarted: ["getLessonActivities", "getNeighboringConcepts", "setActivityAsRunning"],
  lookingUpWords: ["generateSentenceWordMetadata"],
  recordingAudio: ["generateAudio"],
  recordingVocabularyAudio: ["generateVocabularyAudio"],
  recordingWordAudio: ["generateSentenceWordAudio"],
  saving: ["saveReadingActivity", "copyListeningSteps", "saveListeningActivity"],
  savingPrerequisites: ["saveVocabularyActivity", "saveGrammarActivity"],
  writingContent: ["generateGrammarContent"],
} as const satisfies Record<string, readonly ActivityStepName[]>;

type _ValidateListening = AssertAllCovered<
  Exclude<
    ListeningSteps,
    (typeof LISTENING_PHASE_STEPS)[keyof typeof LISTENING_PHASE_STEPS][number]
  >
>;

export const LISTENING_PHASE_ORDER: PhaseName[] = [
  "gettingStarted",
  "buildingWordList",
  "writingContent",
  "addingPronunciation",
  "addingVocabularyRomanization",
  "recordingVocabularyAudio",
  "creatingExercises",
  "addingGrammarRomanization",
  "savingPrerequisites",
  "creatingSentences",
  "creatingAnswerOptions",
  "recordingAudio",
  "addingRomanization",
  "lookingUpWords",
  "recordingWordAudio",
  "addingWordPronunciation",
  "saving",
];

// -- Custom -----------------------------------------------------------------

type CustomSteps =
  | "getLessonActivities"
  | "setActivityAsRunning"
  | "generateCustomContent"
  | "generateVisuals"
  | "generateImages"
  | "saveCustomActivity";

export const CUSTOM_PHASE_STEPS = {
  creatingImages: ["generateImages"],
  gettingStarted: ["getLessonActivities", "setActivityAsRunning"],
  preparingVisuals: ["generateVisuals"],
  saving: ["saveCustomActivity"],
  writingContent: ["generateCustomContent"],
} as const satisfies Record<string, readonly ActivityStepName[]>;

type _ValidateCustom = AssertAllCovered<
  Exclude<CustomSteps, (typeof CUSTOM_PHASE_STEPS)[keyof typeof CUSTOM_PHASE_STEPS][number]>
>;

export const CUSTOM_PHASE_ORDER: PhaseName[] = [
  "gettingStarted",
  "writingContent",
  "preparingVisuals",
  "creatingImages",
  "saving",
];

// -- Explanation ------------------------------------------------------------

type ExplanationSteps =
  | "getLessonActivities"
  | "getNeighboringConcepts"
  | "setActivityAsRunning"
  | "generateExplanationContent"
  | "generateVisuals"
  | "generateImages"
  | "saveExplanationActivity";

export const EXPLANATION_PHASE_STEPS = {
  creatingImages: ["generateImages"],
  gettingStarted: ["getLessonActivities", "getNeighboringConcepts", "setActivityAsRunning"],
  preparingVisuals: ["generateVisuals"],
  saving: ["saveExplanationActivity"],
  writingContent: ["generateExplanationContent"],
} as const satisfies Record<string, readonly ActivityStepName[]>;

type _ValidateExplanation = AssertAllCovered<
  Exclude<
    ExplanationSteps,
    (typeof EXPLANATION_PHASE_STEPS)[keyof typeof EXPLANATION_PHASE_STEPS][number]
  >
>;

export const EXPLANATION_PHASE_ORDER: PhaseName[] = [
  "gettingStarted",
  "writingContent",
  "preparingVisuals",
  "creatingImages",
  "saving",
];

// -- Quiz -------------------------------------------------------------------

type QuizSteps =
  | "getLessonActivities"
  | "getNeighboringConcepts"
  | "setActivityAsRunning"
  | "generateExplanationContent"
  | "generateQuizContent"
  | "generateQuizImages"
  | "saveQuizActivity";

export const QUIZ_PHASE_STEPS = {
  creatingImages: ["generateQuizImages"],
  gettingStarted: ["getLessonActivities", "getNeighboringConcepts", "setActivityAsRunning"],
  saving: ["saveQuizActivity"],
  writingContent: ["generateQuizContent"],
  writingExplanation: ["generateExplanationContent"],
} as const satisfies Record<string, readonly ActivityStepName[]>;

type _ValidateQuiz = AssertAllCovered<
  Exclude<QuizSteps, (typeof QUIZ_PHASE_STEPS)[keyof typeof QUIZ_PHASE_STEPS][number]>
>;

export const QUIZ_PHASE_ORDER: PhaseName[] = [
  "gettingStarted",
  "writingExplanation",
  "writingContent",
  "creatingImages",
  "saving",
];

// -- Practice ---------------------------------------------------------------

type PracticeSteps =
  | "getLessonActivities"
  | "getNeighboringConcepts"
  | "setActivityAsRunning"
  | "generateExplanationContent"
  | "generatePracticeContent"
  | "savePracticeActivity";

export const PRACTICE_PHASE_STEPS = {
  gettingStarted: ["getLessonActivities", "getNeighboringConcepts", "setActivityAsRunning"],
  saving: ["savePracticeActivity"],
  writingContent: ["generatePracticeContent"],
  writingExplanation: ["generateExplanationContent"],
} as const satisfies Record<string, readonly ActivityStepName[]>;

type _ValidatePractice = AssertAllCovered<
  Exclude<PracticeSteps, (typeof PRACTICE_PHASE_STEPS)[keyof typeof PRACTICE_PHASE_STEPS][number]>
>;

export const PRACTICE_PHASE_ORDER: PhaseName[] = [
  "gettingStarted",
  "writingExplanation",
  "writingContent",
  "saving",
];

// -- Challenge --------------------------------------------------------------

type ChallengeSteps =
  | "getLessonActivities"
  | "getNeighboringConcepts"
  | "setActivityAsRunning"
  | "generateExplanationContent"
  | "generateChallengeContent"
  | "saveChallengeActivity";

export const CHALLENGE_PHASE_STEPS = {
  gettingStarted: ["getLessonActivities", "getNeighboringConcepts", "setActivityAsRunning"],
  saving: ["saveChallengeActivity"],
  writingContent: ["generateChallengeContent"],
  writingExplanation: ["generateExplanationContent"],
} as const satisfies Record<string, readonly ActivityStepName[]>;

type _ValidateChallenge = AssertAllCovered<
  Exclude<
    ChallengeSteps,
    (typeof CHALLENGE_PHASE_STEPS)[keyof typeof CHALLENGE_PHASE_STEPS][number]
  >
>;

export const CHALLENGE_PHASE_ORDER: PhaseName[] = [
  "gettingStarted",
  "writingExplanation",
  "writingContent",
  "saving",
];
