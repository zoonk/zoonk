import {
  type ActivityCustomParams,
  type ActivityCustomSchema,
  generateActivityCustom,
} from "@zoonk/ai/tasks/activities/custom";
import { TEST_CASES } from "./test-cases";
import type { Task } from "@/lib/types";

export const activityCustomTask: Task<ActivityCustomParams, ActivityCustomSchema> = {
  description: "Generate procedural steps for a custom activity",
  generate: generateActivityCustom,
  id: "activity-custom",
  name: "Activity Custom",
  testCases: TEST_CASES,
};
