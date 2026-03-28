import { type Task } from "@/lib/types";
import {
  type ActivityDistractorsParams,
  type ActivityDistractorsSchema,
  generateActivityDistractors,
} from "@zoonk/ai/tasks/activities/language/distractors";
import { TEST_CASES } from "./test-cases";

export const activityDistractorsTask: Task<ActivityDistractorsParams, ActivityDistractorsSchema> = {
  description:
    "Generate direct distractor words for translation, reading, and listening activities",
  generate: generateActivityDistractors,
  id: "activity-distractors",
  name: "Activity Distractors",
  testCases: TEST_CASES,
};
