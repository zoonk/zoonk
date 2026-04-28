import { type AssertAllCovered } from "@/lib/generation-phases";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type PhaseName } from "../lesson-generation-phase-config";

type TranslationSteps =
  | "getLesson"
  | "setLessonAsRunning"
  | "saveTranslationLesson"
  | "setLessonAsCompleted";

export const TRANSLATION_PHASE_STEPS = {
  gettingStarted: ["getLesson", "setLessonAsRunning"],
  saving: ["saveTranslationLesson", "setLessonAsCompleted"],
} as const satisfies Record<string, readonly LessonStepName[]>;

type _ValidateTranslation = AssertAllCovered<
  Exclude<
    TranslationSteps,
    (typeof TRANSLATION_PHASE_STEPS)[keyof typeof TRANSLATION_PHASE_STEPS][number]
  >
>;

export const TRANSLATION_PHASE_ORDER: PhaseName[] = ["gettingStarted", "saving"];
