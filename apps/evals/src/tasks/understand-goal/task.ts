import { createChoiceEvaluation } from "@/lib/evaluation-routes";
import { type Task } from "@/lib/types";
import {
  type UnderstandGoalParams,
  goalRouteClassifier,
  understandGoal,
} from "@zoonk/ai/tasks/v2/goals/understand-goal";
import { PERSONA_TEST_CASES } from "./persona-cases";
import { type UnderstandGoalExpected, scoreUnderstandGoal } from "./scorer";
import { TEST_CASES } from "./test-cases";

/**
 * Generation models read the whole goal (route, goals and every fact); evaluation models (Jev)
 * can only pick the route, so their rows compare that choice alone.
 */
export const understandGoalTask: Task<UnderstandGoalParams, unknown, UnderstandGoalExpected> = {
  description:
    "Read a goal typed in the learner's own words: its route and every onboarding answer it already gives",
  evaluate: createChoiceEvaluation({
    classifier: goalRouteClassifier,
    toOutput: (route) => ({ route }),
  }),
  generate: understandGoal,
  id: "understand-goal",
  name: "Understand Goal",
  score: scoreUnderstandGoal,
  testCases: [...TEST_CASES, ...PERSONA_TEST_CASES],
};
