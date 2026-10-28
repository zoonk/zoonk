import { type Task } from "@/lib/types";
import {
  type PlanRoutineFit,
  type PlanRoutineFitParams,
  fitPlanToRoutineFacts,
} from "@zoonk/ai/tasks/v2/plans/routine-fit";
import { type PlanEditExpected, scorePlanEditIntent } from "../plan-edit-intent/scorer";
import { TEST_CASES } from "./test-cases";

export const planRoutineFitTask: Task<PlanRoutineFitParams, PlanRoutineFit, PlanEditExpected> = {
  description:
    "Fit a new plan's week to the learner's routine from memory: days off, lighter days and light weeks",
  generate: fitPlanToRoutineFacts,
  id: "plan-routine-fit",
  name: "Plan Routine Fit",
  score: scorePlanEditIntent,
  testCases: TEST_CASES,
};
