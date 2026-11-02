import { type CourseLevel } from "@zoonk/db";
import { getBandRank } from "../../learner/placement/placement-graph";
import { type TopicLevel } from "../../library/exams/topic-frequency";
import { type PlanGraph } from "./plan-state";
import { getAskedScore, scoreSkillTopics } from "./topic-weights";

export function weighsTopics(input: {
  graph: PlanGraph;
  topicLevels: readonly TopicLevel[];
}): boolean {
  return (
    input.topicLevels.length > 0 ||
    input.graph.skills.some((skill) => (skill.topics ?? []).length > 0)
  );
}

export function getWorth(input: {
  graph: PlanGraph;
  topicLevels: readonly TopicLevel[];
}): (skillId: string) => number {
  if (weighsTopics(input)) {
    return getAskedScore(scoreSkillTopics({ graph: input.graph, levels: input.topicLevels }));
  }

  const outcomes = new Set(
    input.graph.skills.filter((skill) => skill.outcome).map((skill) => skill.skillId),
  );

  return (skillId) => (outcomes.has(skillId) ? 2 : 1);
}

export function isFoundation({
  bands,
  levelFloor,
  neededBy,
  skillId,
}: {
  bands: ReadonlyMap<string, CourseLevel>;
  levelFloor: CourseLevel | null;
  neededBy: readonly string[];
  skillId: string;
}): boolean {
  const band = bands.get(skillId);

  if (!band) {
    return false;
  }

  const rank = getBandRank(band);
  const belowLearner = levelFloor !== null && rank < getBandRank(levelFloor);

  const belowWork = neededBy.every((id) => {
    const above = bands.get(id);
    return above !== undefined && rank < getBandRank(above);
  });

  return belowLearner || belowWork;
}
