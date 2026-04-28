import { type AssertAllCovered } from "@/lib/generation-phases";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type PhaseName } from "../lesson-generation-phase-config";

type PracticeSteps =
  | "getLesson"
  | "setLessonAsRunning"
  | "generatePracticeContent"
  | "generateStepImages"
  | "savePracticeLesson"
  | "setLessonAsCompleted";

export const PRACTICE_PHASE_STEPS = {
  creatingImages: ["generateStepImages"],
  gettingStarted: ["getLesson", "setLessonAsRunning"],
  saving: ["savePracticeLesson", "setLessonAsCompleted"],
  writingContent: ["generatePracticeContent"],
} as const satisfies Record<string, readonly LessonStepName[]>;

type _ValidatePractice = AssertAllCovered<
  Exclude<PracticeSteps, (typeof PRACTICE_PHASE_STEPS)[keyof typeof PRACTICE_PHASE_STEPS][number]>
>;

export const PRACTICE_PHASE_ORDER: PhaseName[] = [
  "gettingStarted",
  "writingContent",
  "creatingImages",
  "saving",
];
