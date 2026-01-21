import {
  type ActivityPronunciationParams,
  type ActivityPronunciationSchema,
  generateActivityPronunciation,
} from "@zoonk/ai/tasks/activities/language/pronunciation";
import type { Task } from "@/lib/types";
import { TEST_CASES } from "./test-cases";

export const activityPronunciationTask: Task<
  ActivityPronunciationParams,
  ActivityPronunciationSchema
> = {
  description:
    "Generate pronunciation guides using native language phonemes for language learners",
  generate: generateActivityPronunciation,
  id: "activity-pronunciation",
  name: "Activity Pronunciation",
  testCases: TEST_CASES,
};
