import { type CourseLevel } from "@zoonk/db";
import { getBandRank } from "../../learner/placement/placement-graph";
import { type TopicLevel } from "../../library/exams/topic-frequency";
import { type PlanGraph } from "./plan-state";
import { getAskedScore, scoreSkillTopics } from "./topic-weights";

/**
 * Whether the goal's bases follow its exam's notice: it says how often the exam asks its topics
 * (`topicLevels`), or the goal's skills list them, so a skill beyond the notice is worth less than
 * a topic built on it.
 */
export function weighsTopics(input: {
  graph: PlanGraph;
  topicLevels: readonly TopicLevel[];
}): boolean {
  return (
    input.topicLevels.length > 0 ||
    input.graph.skills.some((skill) => (skill.topics ?? []).length > 0)
  );
}

/**
 * What a skill is worth to the goal, for telling its bases apart: for an exam whose bases follow
 * its notice (see `weighsTopics`), how often it asks the skill's topics (see `getAskedScore`); for
 * any other goal, its outcome skills (a career change's portfolio and job search) over the skills
 * they build on.
 */
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

/**
 * Whether a skill a goal's outcomes build on is one of its foundations, for a goal that isn't an
 * exam's: from a band below the level the learner said they have, which they may know already, or
 * below every outcome built on it, as basic statistics is for a product's metrics. The skills a
 * career's first project builds on at its own band are the course, its path, never bases (a UX
 * career listed 43 of its 78 skills before). A skill whose band isn't known isn't one.
 */
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
