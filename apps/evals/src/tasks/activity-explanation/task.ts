import { type Task } from "@/lib/types";
import {
  type ActivityExplanationParams,
  type ActivityExplanationSchema,
  generateActivityExplanation,
} from "@zoonk/ai/tasks/activities/core/explanation";
import { TEST_CASES } from "./test-cases";

export const activityExplanationTask: Task<ActivityExplanationParams, ActivityExplanationSchema> = {
  description:
    "Generate a structured explanation activity with a hook, daily-life scenario, concept steps, and a concrete anchor",
  generate: generateActivityExplanation,
  id: "activity-explanation",
  name: "Activity Explanation",
  testCases: TEST_CASES,
};
