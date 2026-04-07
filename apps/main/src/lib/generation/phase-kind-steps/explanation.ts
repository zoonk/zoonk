import { type AssertAllCovered } from "@/lib/generation-phases";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { type PhaseName } from "../activity-generation-phase-config";

type ExplanationSteps =
  | "getLessonActivities"
  | "getNeighboringConcepts"
  | "setActivityAsRunning"
  | "generateExplanationContent"
  | "generateVisualDescriptions"
  | "generateVisualContent"
  | "saveExplanationActivity";

export const EXPLANATION_PHASE_STEPS = {
  creatingVisuals: ["generateVisualContent"],
  gettingStarted: ["getLessonActivities", "getNeighboringConcepts", "setActivityAsRunning"],
  preparingVisuals: ["generateVisualDescriptions"],
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
  "preparingVisuals",
  "creatingVisuals",
  "saving",
];
