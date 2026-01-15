import {
  type ActivityExplanationParams,
  type ActivityExplanationSchema,
  generateActivityExplanation,
} from "@zoonk/ai/activity-explanation/generate";
import type { Task } from "@/lib/types";
import { TEST_CASES } from "./test-cases";

export const activityExplanationTask: Task<
  ActivityExplanationParams,
  ActivityExplanationSchema
> = {
  description:
    "Generate an explanation activity for a lesson that explains what a topic is and how it works conceptually",
  generate: generateActivityExplanation,
  id: "activity-explanation",
  name: "Activity Explanation",
  testCases: TEST_CASES,
};
