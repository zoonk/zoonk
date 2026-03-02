import { type Task } from "@/lib/types";
import {
  type ActivityQuizParams,
  type ActivityQuizSchema,
  generateActivityQuiz,
} from "@zoonk/ai/tasks/activities/core/quiz";
import { TEST_CASES } from "./test-cases";

export const activityQuizTask: Task<ActivityQuizParams, ActivityQuizSchema> = {
  description:
    "Generate quiz questions that test understanding of concepts from a prior Explanation activity",
  generate: generateActivityQuiz,
  id: "activity-quiz",
  name: "Activity Quiz",
  testCases: TEST_CASES,
};
