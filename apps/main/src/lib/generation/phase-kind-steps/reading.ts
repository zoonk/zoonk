import { type AssertAllCovered } from "@/lib/generation-phases";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { type PhaseName } from "../activity-generation-phase-config";

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
