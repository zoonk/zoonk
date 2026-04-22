import { type AssertAllCovered } from "@/lib/generation-phases";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { type PhaseName } from "../activity-generation-phase-config";

type ExplanationSteps =
  | "getLessonActivities"
  | "setActivityAsRunning"
  | "generateExplanationContent"
  | "generateImagePrompts"
  | "generateStepImages"
  | "saveExplanationActivity";

export const EXPLANATION_PHASE_STEPS = {
  creatingImages: ["generateStepImages"],
  gettingStarted: ["getLessonActivities", "setActivityAsRunning"],
  preparingImages: ["generateImagePrompts"],
  saving: ["saveExplanationActivity"],
  writingContent: ["generateExplanationContent"],
} as const satisfies Record<string, readonly ActivityStepName[]>;

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
