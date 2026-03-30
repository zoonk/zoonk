import { type Task } from "@/lib/types";
import {
  type ActivityTradeoffParams,
  type ActivityTradeoffSchema,
  generateActivityTradeoff,
} from "@zoonk/ai/tasks/activities/core/tradeoff";
import { TEST_CASES } from "./test-cases";

export const activityTradeoffTask: Task<ActivityTradeoffParams, ActivityTradeoffSchema> = {
  description:
    "Generate a resource allocation scenario with competing priorities, consequences, and a reflection for tradeoff activities",
  generate: generateActivityTradeoff,
  id: "activity-tradeoff",
  name: "Activity Tradeoff",
  testCases: TEST_CASES,
};
