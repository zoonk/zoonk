import {
  type ActivityReviewParams,
  type ActivityReviewSchema,
  generateActivityReview,
} from "@zoonk/ai/tasks/activities/core/review";
import { TEST_CASES } from "./test-cases";
import type { Task } from "@/lib/types";

export const activityReviewTask: Task<ActivityReviewParams, ActivityReviewSchema> = {
  description:
    "Generate a comprehensive 15-20 question multiple-choice review quiz that tests understanding across Background (WHY), Explanation (WHAT), Mechanics (HOW), and Examples (WHERE) content types",
  generate: generateActivityReview,
  id: "activity-review",
  name: "Activity Review",
  testCases: TEST_CASES,
};
