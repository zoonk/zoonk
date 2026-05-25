import { type AssertAllCovered } from "@/lib/generation-phases";
import { type LessonStepName } from "@zoonk/core/workflows/steps";
import { type PhaseName } from "../generation-phase-config";

type GrammarSteps =
  | "getLesson"
  | "setLessonAsRunning"
  | "generateGrammar"
  | "generateGrammarRomanization"
  | "saveGrammarLesson"
  | "setLessonAsCompleted";

export const GRAMMAR_PHASE_STEPS = {
  addingRomanization: ["generateGrammarRomanization"],
  gettingStarted: ["getLesson", "setLessonAsRunning"],
  saving: ["saveGrammarLesson", "setLessonAsCompleted"],
  writingContent: ["generateGrammar"],
} as const satisfies Record<string, readonly LessonStepName[]>;

type _ValidateGrammar = AssertAllCovered<
  Exclude<GrammarSteps, (typeof GRAMMAR_PHASE_STEPS)[keyof typeof GRAMMAR_PHASE_STEPS][number]>
>;

export const GRAMMAR_PHASE_ORDER: PhaseName[] = [
  "gettingStarted",
  "writingContent",
  "addingRomanization",
  "saving",
];
