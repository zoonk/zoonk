import { COMPARISON_TRADES } from "@/lib/comparisons/trade-defaults";
import { type Task } from "@/lib/types";
import { generateSkillGraph } from "@zoonk/ai/tasks/curriculum/skill-graph";
import { readCriteria } from "../plain-language-criterion";
import { type SkillGraphCase, toLibraryLookup } from "./library-cases";
import { SKILL_GRAPH_SCORE_CATEGORIES } from "./score-categories";
import { type SkillGraphOutput, checkSkillGraphOutput, scoreSkillGraph } from "./scorer";
import { TEST_CASES } from "./test-cases";

async function generate({ library, ...params }: SkillGraphCase) {
  const findLibrarySkills = library ? toLibraryLookup(library) : undefined;
  const { repaired, ...result } = await generateSkillGraph({ ...params, findLibrarySkills });
  return { ...result, data: { ...result.data, repaired } };
}

export const skillGraphTask: Task<SkillGraphCase, SkillGraphOutput> = {
  codeChecks: checkSkillGraphOutput,
  criteria: readCriteria(SKILL_GRAPH_SCORE_CATEGORIES),
  description:
    "Turn a goal into a skill graph: skills with prerequisites, the courses that teach them and phases sized in hours",
  generate,
  id: "skill-graph",
  name: "Skill graph",
  priorities: {
    comparison: {
      criteria: {
        aiEraSkills: "counts",
        coverage: "counts",
        goalFit: "counts",
        granularity: "counts",
        noFiller: "counts",
        orderAndPrerequisites: "counts",
      },
      preference: "canBlock",
      trade: COMPARISON_TRADES.core,
    },
    distribution: "shared",
    first: "quality",
    reads: "A learner sees their plan's skills as they're named",
    reason:
      "Skills are reused across goals; the pricier model kept foundations the cheaper one dropped",
    waits: "A learner waits: skills stream as they're named",
  },
  score: scoreSkillGraph,
  scoreCategories: SKILL_GRAPH_SCORE_CATEGORIES,
  testCases: TEST_CASES,
};
