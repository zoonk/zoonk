import { type Task } from "@/lib/types";
import {
  type SkillGraphParams,
  generateSkillGraph,
} from "@zoonk/ai/tasks/v2/curriculum/skill-graph";
import { SKILL_GRAPH_SCORE_CATEGORIES } from "./score-categories";
import { TEST_CASES } from "./test-cases";

type SkillGraphOutput = Awaited<ReturnType<typeof generateSkillGraph>>["data"];

export const skillGraphTask: Task<SkillGraphParams, SkillGraphOutput> = {
  description:
    "Turn a goal into a skill graph: skills with prerequisites, the courses that teach them and phases sized in hours",
  generate: generateSkillGraph,
  id: "skill-graph",
  name: "Skill Graph",
  scoreCategories: SKILL_GRAPH_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
