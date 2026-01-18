import {
  type ActivityCustomParams,
  type ActivityCustomSchema,
  generateActivityCustom,
} from "@zoonk/ai/tasks/activities/custom";
import type { Task } from "@/lib/types";
import { TEST_CASES } from "./test-cases";

export const activityCustomTask: Task<
  ActivityCustomParams,
  ActivityCustomSchema
> = {
  description: "Generate procedural steps for a custom activity",
  generate: generateActivityCustom,
  id: "activity-custom",
  name: "Activity Custom",
  testCases: TEST_CASES,
};
