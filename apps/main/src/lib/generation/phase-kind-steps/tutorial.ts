import { type AssertAllCovered } from "@/lib/generation-phases";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type PhaseName } from "../lesson-generation-phase-config";

type TutorialSteps =
  | "getLesson"
  | "setLessonAsRunning"
  | "generateTutorialContent"
  | "generateImagePrompts"
  | "generateStepImages"
  | "saveTutorialLesson"
  | "setLessonAsCompleted";

export const TUTORIAL_PHASE_STEPS = {
  creatingImages: ["generateStepImages"],
  gettingStarted: ["getLesson", "setLessonAsRunning"],
  preparingImages: ["generateImagePrompts"],
  saving: ["saveTutorialLesson", "setLessonAsCompleted"],
  writingContent: ["generateTutorialContent"],
} as const satisfies Record<string, readonly LessonStepName[]>;

type _ValidateTutorial = AssertAllCovered<
  Exclude<TutorialSteps, (typeof TUTORIAL_PHASE_STEPS)[keyof typeof TUTORIAL_PHASE_STEPS][number]>
>;

export const TUTORIAL_PHASE_ORDER: PhaseName[] = [
  "gettingStarted",
  "writingContent",
  "preparingImages",
  "creatingImages",
  "saving",
];
