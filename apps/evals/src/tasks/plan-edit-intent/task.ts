import { createChoiceEvaluation } from "@/lib/evaluation-routes";
import { type Task } from "@/lib/types";
import {
  type PlanEditParams,
  interpretPlanEdit,
  planEditKindClassifier,
} from "@zoonk/ai/tasks/v2/plans/edit-intent";
import { CLASS_TEST_FOCUS_TEST_CASES, FOCUS_PART_TEST_CASES } from "./focus-part-cases";
import { MEMORY_TEST_CASES } from "./memory-cases";
import { PERSONA_TEST_CASES } from "./persona-cases";
import { type PlanEditExpected, scorePlanEditIntent } from "./scorer";
import { TEST_CASES } from "./test-cases";

/**
 * Generation models turn the request into the planner's changes; evaluation models (Jev) can only
 * name the first change's kind, so their rows compare that choice alone.
 */
export const planEditIntentTask: Task<PlanEditParams, unknown, PlanEditExpected> = {
  description: "Turn a learner's plain-words request into the plan changes the planner applies",
  evaluate: createChoiceEvaluation({
    classifier: planEditKindClassifier,
    toOutput: (kind) => ({ kind }),
  }),
  generate: interpretPlanEdit,
  id: "plan-edit-intent",
  name: "Plan Edit Intent",
  score: scorePlanEditIntent,
  testCases: [
    ...TEST_CASES,
    ...PERSONA_TEST_CASES,
    ...MEMORY_TEST_CASES,
    ...FOCUS_PART_TEST_CASES,
    ...CLASS_TEST_FOCUS_TEST_CASES,
  ],
};
