import { type AssertAllCovered } from "@/lib/generation-phases";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type PhaseName } from "../generation-phase-config";

type ExplanationSteps =
  | "getLesson"
  | "setLessonAsRunning"
  | "generateExplanationContent"
  | "generateImagePrompts"
  | "saveExplanationLesson"
  | "setLessonAsCompleted";

export const EXPLANATION_PHASE_STEPS = {
  gettingStarted: ["getLesson", "setLessonAsRunning"],
  saving: ["saveExplanationLesson", "setLessonAsCompleted"],
  writingContent: ["generateExplanationContent", "generateImagePrompts"],
} as const satisfies Record<string, readonly LessonStepName[]>;

type _ValidateExplanation = AssertAllCovered<
  Exclude<
    ExplanationSteps,
    (typeof EXPLANATION_PHASE_STEPS)[keyof typeof EXPLANATION_PHASE_STEPS][number]
  >
>;

export const EXPLANATION_PHASE_ORDER: PhaseName[] = ["gettingStarted", "writingContent", "saving"];
