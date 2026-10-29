import { type Task } from "@/lib/types";
import {
  type PlanRoutineFit,
  type PlanRoutineFitParams,
  fitPlanToRoutineFacts,
} from "@zoonk/ai/tasks/v2/plans/routine-fit";
import { MAX_DAILY_MINUTES, MIN_DAILY_MINUTES } from "@zoonk/core/plans/daily-minutes";
import { type PlanEditExpected, scorePlanEditIntent } from "../plan-edit-intent/scorer";
import { TEST_CASES } from "./test-cases";

export const planRoutineFitTask: Task<
  Omit<PlanRoutineFitParams, "dailyMinutesLimits">,
  PlanRoutineFit,
  PlanEditExpected
> = {
  description:
    "Fit a new plan's week to the learner's routine from memory: days off, lighter days and light weeks",
  generate: (params) =>
    fitPlanToRoutineFacts({
      ...params,
      dailyMinutesLimits: { max: MAX_DAILY_MINUTES, min: MIN_DAILY_MINUTES },
    }),
  id: "plan-routine-fit",
  name: "Plan Routine Fit",
  score: scorePlanEditIntent,
  testCases: TEST_CASES,
};
