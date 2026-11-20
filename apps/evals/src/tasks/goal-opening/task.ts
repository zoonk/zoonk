import { type Task } from "@/lib/types";
import {
  type GoalOpeningParams,
  generateGoalOpening,
} from "@zoonk/ai/tasks/curriculum/goal-opening";
import { TEST_CASES } from "./test-cases";

type GoalOpeningOutput = Awaited<ReturnType<typeof generateGoalOpening>>["data"];

export const goalOpeningTask: Task<GoalOpeningParams, GoalOpeningOutput> = {
  criteria: [],
  description:
    "Pick a learn goal's first skill, the course that teaches it and that skill's first chapter, so the first lesson is written before the plan",
  generate: generateGoalOpening,
  id: "goal-opening",
  name: "Goal opening",
  priorities: {
    comparison: { criteria: {}, preference: "separates", trade: null },
    distribution: "shared",
    first: "latency",
    reads: "A learner starts their first lesson from the opening it picks",
    reason:
      "Every call before the first lesson is one the learner waits on; shared when the goal's general form is",
    waits: "A learner waits in the request",
  },
  testCases: TEST_CASES,
};
