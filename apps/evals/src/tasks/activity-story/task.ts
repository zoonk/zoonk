import { type Task } from "@/lib/types";
import {
  type ActivityStoryParams,
  type ActivityStoryPlanSchema,
  generateActivityStory,
} from "@zoonk/ai/tasks/activities/core/story";
import { TEST_CASES } from "./test-cases";

export const activityStoryTask: Task<ActivityStoryParams, ActivityStoryPlanSchema> = {
  description:
    "Generate a story activity plan with intro, metrics, decision problems, image prompts, and outcomes",
  generate: generateActivityStory,
  id: "activity-story",
  name: "Activity Story",
  testCases: TEST_CASES,
};
