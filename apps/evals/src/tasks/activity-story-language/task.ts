import {
  type ActivityStoryLanguageParams,
  type ActivityStoryLanguageSchema,
  generateActivityStoryLanguage,
} from "@zoonk/ai/tasks/activities/language/story";
import type { Task } from "@/lib/types";
import { TEST_CASES } from "./test-cases";

export const activityStoryLanguageTask: Task<
  ActivityStoryLanguageParams,
  ActivityStoryLanguageSchema
> = {
  description:
    "Generate immersive dialogue-driven story activities for language learning lessons",
  generate: generateActivityStoryLanguage,
  id: "activity-story-language",
  name: "Activity Story (Language)",
  testCases: TEST_CASES,
};
