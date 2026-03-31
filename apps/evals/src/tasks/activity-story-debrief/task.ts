import { type Task } from "@/lib/types";
import {
  type ActivityStoryDebriefParams,
  type ActivityStoryDebriefSchema,
  generateActivityStoryDebrief,
} from "@zoonk/ai/tasks/activities/core/story-debrief";
import { TEST_CASES } from "./test-cases";

export const activityStoryDebriefTask: Task<
  ActivityStoryDebriefParams,
  ActivityStoryDebriefSchema
> = {
  description: "Generate outcome tiers and debrief concepts from a completed story activity",
  generate: generateActivityStoryDebrief,
  id: "activity-story-debrief",
  name: "Activity Story Debrief",
  testCases: TEST_CASES,
};
