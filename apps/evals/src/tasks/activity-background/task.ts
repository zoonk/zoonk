import {
  type ActivityBackgroundParams,
  type ActivityBackgroundSchema,
  generateActivityBackground,
} from "@zoonk/ai/tasks/activities/core/background";
import { TEST_CASES } from "./test-cases";
import type { Task } from "@/lib/types";

export const activityBackgroundTask: Task<ActivityBackgroundParams, ActivityBackgroundSchema> = {
  description:
    "Generate a background activity for a lesson that explains why a topic exists and why it matters",
  generate: generateActivityBackground,
  id: "activity-background",
  name: "Activity Background",
  testCases: TEST_CASES,
};
