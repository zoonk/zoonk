import { type Task } from "@/lib/types";
import {
  type ActivityStoryChoicesParams,
  type ActivityStoryChoicesSchema,
  generateActivityStoryChoices,
} from "@zoonk/ai/tasks/activities/core/story-choices";
import { TEST_CASES } from "./test-cases";

export const activityStoryChoicesTask: Task<
  ActivityStoryChoicesParams,
  ActivityStoryChoicesSchema
> = {
  description:
    "Generate fair story choices, consequences, metric effects, and state image prompts for an existing story plan",
  generate: generateActivityStoryChoices,
  id: "activity-story-choices",
  name: "Activity Story Choices",
  testCases: TEST_CASES,
};
