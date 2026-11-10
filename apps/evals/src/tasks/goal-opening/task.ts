import { type Task } from "@/lib/types";
import {
  type GoalOpeningParams,
  generateGoalOpening,
} from "@zoonk/ai/tasks/curriculum/goal-opening";
import { TEST_CASES } from "./test-cases";

type GoalOpeningOutput = Awaited<ReturnType<typeof generateGoalOpening>>["data"];

export const goalOpeningTask: Task<GoalOpeningParams, GoalOpeningOutput> = {
  description:
    "Pick a learn goal's first skill, the course that teaches it and that skill's first chapter, so the first lesson is written before the plan",
  generate: generateGoalOpening,
  id: "goal-opening",
  name: "Goal Opening",
  testCases: TEST_CASES,
};
