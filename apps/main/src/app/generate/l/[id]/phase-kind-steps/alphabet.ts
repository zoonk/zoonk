import { type AssertAllCovered } from "@/lib/generation-phases";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type PhaseName } from "../generation-phase-config";

type AlphabetSteps =
  | "generateAlphabetAudio"
  | "generateAlphabetContent"
  | "getLesson"
  | "saveAlphabetLesson"
  | "setLessonAsRunning"
  | "setLessonAsCompleted";

export const ALPHABET_PHASE_STEPS = {
  gettingStarted: ["getLesson", "setLessonAsRunning"],
  recordingAudio: ["generateAlphabetAudio"],
  saving: ["saveAlphabetLesson", "setLessonAsCompleted"],
  writingContent: ["generateAlphabetContent"],
} as const satisfies Record<string, readonly LessonStepName[]>;

type _ValidateAlphabet = AssertAllCovered<
  Exclude<AlphabetSteps, (typeof ALPHABET_PHASE_STEPS)[keyof typeof ALPHABET_PHASE_STEPS][number]>
>;

export const ALPHABET_PHASE_ORDER: PhaseName[] = [
  "gettingStarted",
  "writingContent",
  "recordingAudio",
  "saving",
];
