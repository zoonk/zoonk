import { type AssertAllCovered } from "@/lib/generation-phases";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type PhaseName } from "../lesson-generation-phase-config";

type ListeningSteps =
  | "getLesson"
  | "setLessonAsRunning"
  | "saveListeningLesson"
  | "setLessonAsCompleted";

export const LISTENING_PHASE_STEPS = {
  gettingStarted: ["getLesson", "setLessonAsRunning"],
  saving: ["saveListeningLesson", "setLessonAsCompleted"],
} as const satisfies Record<string, readonly LessonStepName[]>;

type _ValidateListening = AssertAllCovered<
  Exclude<
    ListeningSteps,
    (typeof LISTENING_PHASE_STEPS)[keyof typeof LISTENING_PHASE_STEPS][number]
  >
>;

export const LISTENING_PHASE_ORDER: PhaseName[] = ["gettingStarted", "saving"];
