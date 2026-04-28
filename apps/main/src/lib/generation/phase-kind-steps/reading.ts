import { type AssertAllCovered } from "@/lib/generation-phases";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type PhaseName } from "../lesson-generation-phase-config";

type ReadingSteps =
  | "getLesson"
  | "setLessonAsRunning"
  | "generateReadingContent"
  | "generateSentenceDistractors"
  | "generateReadingAudio"
  | "generateReadingRomanization"
  | "generateSentenceWordMetadata"
  | "generateSentenceWordAudio"
  | "generateSentenceWordPronunciation"
  | "saveReadingLesson"
  | "setLessonAsCompleted";

export const READING_PHASE_STEPS = {
  addingRomanization: ["generateReadingRomanization"],
  addingWordPronunciation: ["generateSentenceWordPronunciation"],
  creatingExercises: ["generateSentenceDistractors"],
  creatingSentences: ["generateReadingContent"],
  gettingStarted: ["getLesson", "setLessonAsRunning"],
  lookingUpWords: ["generateSentenceWordMetadata"],
  recordingAudio: ["generateReadingAudio"],
  recordingWordAudio: ["generateSentenceWordAudio"],
  saving: ["saveReadingLesson", "setLessonAsCompleted"],
} as const satisfies Record<string, readonly LessonStepName[]>;

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
