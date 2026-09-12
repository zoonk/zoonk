import { type AssertAllCovered } from "@/lib/generation-phases";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type PhaseName } from "../generation-phase-config";

type TutorialSteps =
  | "getLesson"
  | "setLessonAsRunning"
  | "generateTutorialContent"
  | "generateImagePrompts"
  | "saveTutorialLesson"
  | "setLessonAsCompleted";

export const TUTORIAL_PHASE_STEPS = {
  gettingStarted: ["getLesson", "setLessonAsRunning"],
  saving: ["saveTutorialLesson", "setLessonAsCompleted"],
  writingContent: ["generateTutorialContent", "generateImagePrompts"],
} as const satisfies Record<string, readonly LessonStepName[]>;

type _ValidateTutorial = AssertAllCovered<
  Exclude<TutorialSteps, (typeof TUTORIAL_PHASE_STEPS)[keyof typeof TUTORIAL_PHASE_STEPS][number]>
>;

export const TUTORIAL_PHASE_ORDER: PhaseName[] = ["gettingStarted", "writingContent", "saving"];
