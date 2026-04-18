import { type AssertAllCovered } from "@/lib/generation-phases";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { type PhaseName } from "../activity-generation-phase-config";

type QuizSteps =
  | "getLessonActivities"
  | "setActivityAsRunning"
  | "generateExplanationContent"
  | "generateQuizContent"
  | "generateQuizImages"
  | "saveQuizActivity";

export const QUIZ_PHASE_STEPS = {
  creatingImages: ["generateQuizImages"],
  gettingStarted: ["getLessonActivities", "setActivityAsRunning"],
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
