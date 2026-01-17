import {
  type ActivityStoryParams,
  type ActivityStorySchema,
  generateActivityStory,
} from "@zoonk/ai/tasks/activities/core/story";
import type { Task } from "@/lib/types";
import { TEST_CASES } from "./test-cases";

export const activityStoryTask: Task<ActivityStoryParams, ActivityStorySchema> =
  {
    description:
      "Generate a story activity where learners solve problems through dialogue with a colleague",
    generate: generateActivityStory,
    id: "activity-story",
    name: "Activity Story",
    testCases: TEST_CASES,
  };
