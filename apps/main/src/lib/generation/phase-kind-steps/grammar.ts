import { type AssertAllCovered } from "@/lib/generation-phases";
import { type ActivityStepName } from "@zoonk/core/workflows/steps";
import { type PhaseName } from "../activity-generation-phase-config";

type GrammarSteps =
  | "getLessonActivities"
  | "getNeighboringConcepts"
  | "setActivityAsRunning"
  | "generateGrammarContent"
  | "generateGrammarUserContent"
  | "generateGrammarRomanization"
  | "saveGrammarActivity";

export const GRAMMAR_PHASE_STEPS = {
  addingRomanization: ["generateGrammarRomanization"],
  creatingExercises: ["generateGrammarUserContent"],
  gettingStarted: ["getLessonActivities", "getNeighboringConcepts", "setActivityAsRunning"],
  saving: ["saveGrammarActivity"],
  writingContent: ["generateGrammarContent"],
} as const satisfies Record<string, readonly ActivityStepName[]>;

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
