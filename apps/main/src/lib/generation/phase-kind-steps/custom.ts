import { type AssertAllCovered } from "@/lib/generation-phases";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { type PhaseName } from "../activity-generation-phase-config";

type CustomSteps =
  | "getLessonActivities"
  | "setActivityAsRunning"
  | "generateCustomContent"
  | "generateImagePrompts"
  | "generateStepImages"
  | "saveCustomActivity";

export const CUSTOM_PHASE_STEPS = {
  creatingImages: ["generateStepImages"],
  gettingStarted: ["getLessonActivities", "setActivityAsRunning"],
  preparingImages: ["generateImagePrompts"],
  saving: ["saveCustomActivity"],
  writingContent: ["generateCustomContent"],
} as const satisfies Record<string, readonly ActivityStepName[]>;

type _ValidateCustom = AssertAllCovered<
  Exclude<CustomSteps, (typeof CUSTOM_PHASE_STEPS)[keyof typeof CUSTOM_PHASE_STEPS][number]>
>;

export const CUSTOM_PHASE_ORDER: PhaseName[] = [
  "gettingStarted",
  "writingContent",
  "preparingImages",
  "creatingImages",
  "saving",
];
