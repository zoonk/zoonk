import { type AssertAllCovered } from "@/lib/generation-phases";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { type PhaseName } from "../activity-generation-phase-config";

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
