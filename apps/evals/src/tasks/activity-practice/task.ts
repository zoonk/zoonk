import { type Task } from "@/lib/types";
import {
  type ActivityPracticeParams,
  type ActivityPracticeSchema,
  generateActivityPractice,
} from "@zoonk/ai/tasks/activities/core/practice";
import { TEST_CASES } from "./test-cases";

export const activityPracticeTask: Task<ActivityPracticeParams, ActivityPracticeSchema> = {
  description:
    "Generate a practice activity where learners solve problems through dialogue with a colleague",
  generate: generateActivityPractice,
  id: "activity-practice",
  name: "Activity Practice",
  testCases: TEST_CASES,
};
