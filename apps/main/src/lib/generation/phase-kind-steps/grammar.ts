import { type AssertAllCovered } from "@/lib/generation-phases";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type PhaseName } from "../lesson-generation-phase-config";

type GrammarSteps =
  | "getLesson"
  | "setLessonAsRunning"
  | "generateGrammarContent"
  | "generateGrammarUserContent"
  | "generateGrammarRomanization"
  | "saveGrammarLesson"
  | "setLessonAsCompleted";

export const GRAMMAR_PHASE_STEPS = {
  addingRomanization: ["generateGrammarRomanization"],
  creatingExercises: ["generateGrammarUserContent"],
  gettingStarted: ["getLesson", "setLessonAsRunning"],
  saving: ["saveGrammarLesson", "setLessonAsCompleted"],
  writingContent: ["generateGrammarContent"],
} as const satisfies Record<string, readonly LessonStepName[]>;

type _ValidateGrammar = AssertAllCovered<
  Exclude<GrammarSteps, (typeof GRAMMAR_PHASE_STEPS)[keyof typeof GRAMMAR_PHASE_STEPS][number]>
>;

export const GRAMMAR_PHASE_ORDER: PhaseName[] = [
  "gettingStarted",
  "writingContent",
  "creatingExercises",
  "addingRomanization",
  "saving",
];
