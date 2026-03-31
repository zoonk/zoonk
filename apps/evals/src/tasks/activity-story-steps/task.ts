import { type Task } from "@/lib/types";
import {
  type ActivityStoryStepsParams,
  type ActivityStoryStepsSchema,
  generateActivityStorySteps,
} from "@zoonk/ai/tasks/activities/core/story-steps";
import { TEST_CASES } from "./test-cases";

export const activityStoryStepsTask: Task<ActivityStoryStepsParams, ActivityStoryStepsSchema> = {
  description:
    "Generate a story activity with intro, metrics, and decision steps where learners discover concepts through consequences",
  generate: generateActivityStorySteps,
  id: "activity-story-steps",
  name: "Activity Story Steps",
  testCases: TEST_CASES,
};
