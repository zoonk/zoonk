import { type Task } from "@/lib/types";
import {
  type ActivityMechanicsParams,
  type ActivityMechanicsSchema,
  generateActivityMechanics,
} from "@zoonk/ai/tasks/activities/core/mechanics";
import { TEST_CASES } from "./test-cases";

export const activityMechanicsTask: Task<ActivityMechanicsParams, ActivityMechanicsSchema> = {
  description: "Generate a mechanics activity that explains how a topic works step by step",
  generate: generateActivityMechanics,
  id: "activity-mechanics",
  name: "Activity Mechanics",
  testCases: TEST_CASES,
};
