import { createChoiceEvaluation } from "@/lib/evaluation-routes";
import { type Task } from "@/lib/types";
import {
  type UnderstandGoalParams,
  goalRouteClassifier,
  understandGoal,
} from "@zoonk/ai/tasks/v2/goals/understand-goal";
import { MAX_DAILY_MINUTES, MIN_DAILY_MINUTES } from "@zoonk/core/plans/daily-minutes";
import { PERSONA_TEST_CASES } from "./persona-cases";
import { type UnderstandGoalExpected, scoreUnderstandGoal } from "./scorer";
import { TEST_CASES } from "./test-cases";

export const understandGoalTask: Task<
  Omit<UnderstandGoalParams, "dailyMinutesLimits">,
  unknown,
  UnderstandGoalExpected
> = {
  description:
    "Read a goal typed in the learner's own words: its route and every onboarding answer it already gives",
  evaluate: createChoiceEvaluation({
    classifier: goalRouteClassifier,
    toOutput: (route) => ({ route }),
  }),
  generate: (params) =>
    understandGoal({
      ...params,
      dailyMinutesLimits: { max: MAX_DAILY_MINUTES, min: MIN_DAILY_MINUTES },
    }),
  id: "understand-goal",
  name: "Understand Goal",
  score: scoreUnderstandGoal,
  testCases: [...TEST_CASES, ...PERSONA_TEST_CASES],
};
