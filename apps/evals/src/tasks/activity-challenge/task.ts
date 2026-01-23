import {
  type ActivityChallengeParams,
  type ActivityChallengeSchema,
  generateActivityChallenge,
} from "@zoonk/ai/tasks/activities/core/challenge";
import { TEST_CASES } from "./test-cases";
import type { Task } from "@/lib/types";

export const activityChallengeTask: Task<ActivityChallengeParams, ActivityChallengeSchema> = {
  description:
    "Generate a choose-your-own-adventure challenge where learners make strategic decisions with meaningful consequences and trade-offs",
  generate: generateActivityChallenge,
  id: "activity-challenge",
  name: "Activity Challenge",
  testCases: TEST_CASES,
};
