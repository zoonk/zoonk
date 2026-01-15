import {
  type ActivityExplanationQuizParams,
  type ActivityExplanationQuizSchema,
  generateActivityExplanationQuiz,
} from "@zoonk/ai/activity-explanation-quiz/generate";
import type { Task } from "@/lib/types";
import { TEST_CASES } from "./test-cases";

export const activityExplanationQuizTask: Task<
  ActivityExplanationQuizParams,
  ActivityExplanationQuizSchema
> = {
  description:
    "Generate quiz questions that test understanding of concepts from a prior Explanation activity",
  generate: generateActivityExplanationQuiz,
  id: "activity-explanation-quiz",
  name: "Activity Explanation Quiz",
  testCases: TEST_CASES,
};
