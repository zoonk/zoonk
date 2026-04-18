import { type AssertAllCovered } from "@/lib/generation-phases";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { type PhaseName } from "../activity-generation-phase-config";

type PracticeSteps =
  | "getLessonActivities"
  | "setActivityAsRunning"
  | "generateExplanationContent"
  | "generatePracticeContent"
  | "savePracticeActivity";

export const PRACTICE_PHASE_STEPS = {
  gettingStarted: ["getLessonActivities", "setActivityAsRunning"],
  saving: ["savePracticeActivity"],
  writingContent: ["generatePracticeContent"],
  writingExplanation: ["generateExplanationContent"],
} as const satisfies Record<string, readonly ActivityStepName[]>;

type _ValidatePractice = AssertAllCovered<
  Exclude<PracticeSteps, (typeof PRACTICE_PHASE_STEPS)[keyof typeof PRACTICE_PHASE_STEPS][number]>
>;

export const PRACTICE_PHASE_ORDER: PhaseName[] = [
  "gettingStarted",
  "writingExplanation",
  "writingContent",
  "saving",
];
