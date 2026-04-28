import { type AssertAllCovered } from "@/lib/generation-phases";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type PhaseName } from "../lesson-generation-phase-config";

type VocabularySteps =
  | "getLesson"
  | "setLessonAsRunning"
  | "generateVocabularyContent"
  | "generateVocabularyDistractors"
  | "generateVocabularyPronunciation"
  | "generateVocabularyRomanization"
  | "generateVocabularyAudio"
  | "saveVocabularyLesson"
  | "setLessonAsCompleted";

export const VOCABULARY_PHASE_STEPS = {
  addingPronunciation: ["generateVocabularyPronunciation"],
  addingRomanization: ["generateVocabularyRomanization"],
  buildingWordList: ["generateVocabularyContent"],
  creatingExercises: ["generateVocabularyDistractors"],
  gettingStarted: ["getLesson", "setLessonAsRunning"],
  recordingAudio: ["generateVocabularyAudio"],
  saving: ["saveVocabularyLesson", "setLessonAsCompleted"],
} as const satisfies Record<string, readonly LessonStepName[]>;

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
