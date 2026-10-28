import { createBooleanEvaluation } from "@/lib/evaluation-routes";
import { type Task } from "@/lib/types";
import {
  type GoalSpecificityParams,
  type GoalSpecificitySchema,
  classifyGoalSpecificity,
  goalSpecificityClassifier,
} from "@zoonk/ai/tasks/v2/identity/goal-specificity";
import { type GoalSpecificityExpected, scoreGoalSpecificity } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const goalSpecificityTask: Task<
  GoalSpecificityParams,
  GoalSpecificitySchema | Pick<GoalSpecificitySchema, "privateCourse">,
  GoalSpecificityExpected
> = {
  description:
    "Split a goal into shared and personal parts, and flag goals that need a private course",
  evaluate: createBooleanEvaluation({
    classifier: goalSpecificityClassifier,
    toOutput: (privateCourse) => ({ privateCourse }),
  }),
  generate: classifyGoalSpecificity,
  id: "goal-specificity",
  name: "Goal Specificity",
  score: scoreGoalSpecificity,
  testCases: TEST_CASES,
};
