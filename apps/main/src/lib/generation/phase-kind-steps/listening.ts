import { type AssertAllCovered } from "@/lib/generation-phases";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { type PhaseName } from "../activity-generation-phase-config";

/**
 * Listening runs the entire language pipeline: vocabulary + grammar in parallel,
 * then reading, then copies reading steps for the listening activity.
 * Each AI/TTS call gets its own phase. Vocabulary and grammar phases run in
 * parallel, so phases may complete out of order — that's fine.
 *
 * Listening needs its own phase names for romanization and audio because
 * it runs vocabulary, grammar, AND reading — the same underlying steps
 * (e.g., generateVocabularyRomanization vs generateReadingRomanization)
 * need different phases since they're separate AI calls in the same flow.
 */

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
