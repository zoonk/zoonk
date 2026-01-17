import {
  type ActivityChallengeParams,
  type ActivityChallengeSchema,
  generateActivityChallenge,
} from "@zoonk/ai/tasks/activities/core/challenge";
import type { Task } from "@/lib/types";
import { TEST_CASES } from "./test-cases";

export const activityChallengeTask: Task<
  ActivityChallengeParams,
  ActivityChallengeSchema
> = {
  description:
    "Generate a challenge activity where learners make strategic decisions affecting inventory variables to meet win conditions",
  generate: generateActivityChallenge,
  id: "activity-challenge",
  name: "Activity Challenge",
  testCases: TEST_CASES,
};
