import { type Task } from "@/lib/types";
import { generateSkillGraph } from "@zoonk/ai/tasks/curriculum/skill-graph";
import { type SkillGraphCase, toLibraryLookup } from "./library-cases";
import { SKILL_GRAPH_SCORE_CATEGORIES } from "./score-categories";
import { type SkillGraphOutput, scoreSkillGraph } from "./scorer";
import { TEST_CASES } from "./test-cases";

async function generate({ library, ...params }: SkillGraphCase) {
  const findLibrarySkills = library ? toLibraryLookup(library) : undefined;
  const { repaired, ...result } = await generateSkillGraph({ ...params, findLibrarySkills });
  return { ...result, data: { ...result.data, repaired } };
}

export const skillGraphTask: Task<SkillGraphCase, SkillGraphOutput> = {
  description:
    "Turn a goal into a skill graph: skills with prerequisites, the courses that teach them and phases sized in hours",
  generate,
  id: "skill-graph",
  name: "Skill Graph",
  score: scoreSkillGraph,
  scoreCategories: SKILL_GRAPH_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
