import { type Task } from "@/lib/types";
import {
  type SkillGraphParams,
  generateSkillGraph,
} from "@zoonk/ai/tasks/v2/curriculum/skill-graph";
import { SKILL_GRAPH_SCORE_CATEGORIES } from "./score-categories";
import { type SkillGraphOutput, scoreSkillGraph } from "./scorer";
import { TEST_CASES } from "./test-cases";

/** The graph with what code repaired in it, so the scorer counts those flaws too. */
async function generate(params: SkillGraphParams) {
  const { repaired, ...result } = await generateSkillGraph(params);
  return { ...result, data: { ...result.data, repaired } };
}

export const skillGraphTask: Task<SkillGraphParams, SkillGraphOutput> = {
  description:
    "Turn a goal into a skill graph: skills with prerequisites, the courses that teach them and phases sized in hours",
  generate,
  id: "skill-graph",
  name: "Skill Graph",
  score: scoreSkillGraph,
  scoreCategories: SKILL_GRAPH_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
