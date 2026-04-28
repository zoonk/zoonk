import { type AssertAllCovered } from "@/lib/generation-phases";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type PhaseName } from "../lesson-generation-phase-config";

type ExplanationSteps =
  | "getLesson"
  | "setLessonAsRunning"
  | "generateExplanationContent"
  | "generateImagePrompts"
  | "generateStepImages"
  | "saveExplanationLesson"
  | "setLessonAsCompleted";

export const EXPLANATION_PHASE_STEPS = {
  creatingImages: ["generateStepImages"],
  gettingStarted: ["getLesson", "setLessonAsRunning"],
  preparingImages: ["generateImagePrompts"],
  saving: ["saveExplanationLesson", "setLessonAsCompleted"],
  writingContent: ["generateExplanationContent"],
} as const satisfies Record<string, readonly LessonStepName[]>;

type _ValidateExplanation = AssertAllCovered<
  Exclude<
    ExplanationSteps,
    (typeof EXPLANATION_PHASE_STEPS)[keyof typeof EXPLANATION_PHASE_STEPS][number]
  >
>;

export const EXPLANATION_PHASE_ORDER: PhaseName[] = [
  "gettingStarted",
  "writingContent",
  "preparingImages",
  "creatingImages",
  "saving",
];
