import { type CoverageCheckParams, checkCoverage } from "@zoonk/ai/tasks/curriculum/coverage-check";
import { type SkillGraphParams } from "@zoonk/ai/tasks/curriculum/skill-graph-calls";
import { type GoalSkillGraph } from "@zoonk/core/library/curriculum/save-goal-skills";

export function readGraphCoverage({
  graph,
  params,
  references,
}: {
  graph: GoalSkillGraph;
  params: SkillGraphParams;
  references: CoverageCheckParams["references"];
}) {
  return checkCoverage({
    analytics: params.analytics,
    courses: graph.courses.map(({ key, title }) => ({ key, title })),
    examOutline: params.goalKind === "exam" ? params.examBlueprint : undefined,
    goal: params.goal,
    goalKind: params.goalKind,
    language: params.language,
    references,
    serviceTier: params.serviceTier,
    skills: graph.skills.map(
      ({ area, description, estimatedLessons, examWeight, key, name, topics }) => ({
        area,
        description,
        estimatedLessons,
        examWeight,
        key,
        name,
        topics,
      }),
    ),
  });
}
