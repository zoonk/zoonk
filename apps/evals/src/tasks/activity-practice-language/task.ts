import { type Task } from "@/lib/types";
import {
  type ActivityPracticeLanguageParams,
  type ActivityPracticeLanguageSchema,
  generateActivityPracticeLanguage,
} from "@zoonk/ai/tasks/activities/language/practice";
import { TEST_CASES } from "./test-cases";

export const activityPracticeLanguageTask: Task<
  ActivityPracticeLanguageParams,
  ActivityPracticeLanguageSchema
> = {
  description:
    "Generate immersive dialogue-driven practice activities for language learning lessons",
  generate: generateActivityPracticeLanguage,
  id: "activity-practice-language",
  name: "Activity Practice (Language)",
  testCases: TEST_CASES,
};
