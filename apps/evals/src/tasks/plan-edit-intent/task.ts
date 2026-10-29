import { createChoiceEvaluation } from "@/lib/evaluation-routes";
import { type Task } from "@/lib/types";
import {
  type PlanEditParams,
  interpretPlanEdit,
  planEditKindClassifier,
} from "@zoonk/ai/tasks/v2/plans/edit-intent";
import { MAX_DAILY_MINUTES, MIN_DAILY_MINUTES } from "@zoonk/core/plans/daily-minutes";
import { CLASS_TEST_FOCUS_TEST_CASES, FOCUS_PART_TEST_CASES } from "./focus-part-cases";
import { MEMORY_TEST_CASES } from "./memory-cases";
import { PERSONA_TEST_CASES } from "./persona-cases";
import { type PlanEditExpected, scorePlanEditIntent } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const planEditIntentTask: Task<
  Omit<PlanEditParams, "dailyMinutesLimits">,
  unknown,
  PlanEditExpected
> = {
  description: "Turn a learner's plain-words request into the plan changes the planner applies",
  evaluate: createChoiceEvaluation({
    classifier: planEditKindClassifier,
    toOutput: (kind) => ({ kind }),
  }),
  generate: (params) =>
    interpretPlanEdit({
      ...params,
      dailyMinutesLimits: { max: MAX_DAILY_MINUTES, min: MIN_DAILY_MINUTES },
    }),
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
