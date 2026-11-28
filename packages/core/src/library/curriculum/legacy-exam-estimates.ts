import { getSkillArea } from "../../plans/planner/graph-areas";
import { type PlanGraph, type PlanGraphSkill } from "../../plans/planner/plan-state";
import { estimateTopicLessons } from "./uncovered-topic-skill";

export const LEGACY_COVERAGE_LESSONS = 2;

export function isLegacyCoverageEstimate(skill: PlanGraphSkill): boolean {
  return skill.lessons === LEGACY_COVERAGE_LESSONS && !skill.sizedEstimate;
}

export function sizeLegacyExamSkills(graph: PlanGraph): PlanGraph {
  if (
    ![...graph.skills, ...(graph.extraSkills ?? [])].some((skill) =>
      isLegacyCoverageEstimate(skill),
    )
  ) {
    return graph;
  }

  const estimate = estimateTopicLessons(
    graph.skills
      .filter((skill) => !skill.extra)
      .map((skill) => ({
        area: getSkillArea({ graph, skill }),
        estimatedLessons: skill.lessons,
        legacyEstimate: isLegacyCoverageEstimate(skill),
        topics: skill.topics,
      })),
  );

  const size = (skill: PlanGraphSkill): PlanGraphSkill => {
    const perTopic = isLegacyCoverageEstimate(skill) && estimate(getSkillArea({ graph, skill }));

    return perTopic
      ? { ...skill, lessons: perTopic * Math.max(1, skill.topics?.length ?? 0) }
      : skill;
  };

  return {
    ...graph,
    ...(graph.extraSkills && { extraSkills: graph.extraSkills.map(size) }),
    skills: graph.skills.map(size),
  };
}
