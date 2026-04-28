import { type AssertAllCovered } from "@/lib/generation-phases";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type PhaseName } from "../lesson-generation-phase-config";

type QuizSteps =
  | "getLesson"
  | "setLessonAsRunning"
  | "generateQuizContent"
  | "generateQuizImages"
  | "saveQuizLesson"
  | "setLessonAsCompleted";

export const QUIZ_PHASE_STEPS = {
  creatingImages: ["generateQuizImages"],
  gettingStarted: ["getLesson", "setLessonAsRunning"],
  saving: ["saveQuizLesson", "setLessonAsCompleted"],
  writingContent: ["generateQuizContent"],
} as const satisfies Record<string, readonly LessonStepName[]>;

type _ValidateQuiz = AssertAllCovered<
  Exclude<QuizSteps, (typeof QUIZ_PHASE_STEPS)[keyof typeof QUIZ_PHASE_STEPS][number]>
>;

export const QUIZ_PHASE_ORDER: PhaseName[] = [
  "gettingStarted",
  "writingContent",
  "creatingImages",
  "saving",
];
