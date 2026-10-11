import { normalizeString } from "@zoonk/utils/string";
import { type TopicLevel } from "../../library/exams/topic-frequency";
import { toTopicKey } from "../../library/exams/topic-key";
import { type PlanGraph, type PlanGraphSkill } from "./plan-state";

/** How much a topic counts inside its subject, by how often the exam asks it. */
const LEVEL_SCORES: Record<TopicLevel["level"], number> = { high: 3, low: 1, medium: 2 };

/** A topic nothing rates counts as the middle: a ranking that leaves it out says nothing of it. */
const UNRATED_SCORE = LEVEL_SCORES.medium;

function toKey({ subject, topic }: { subject: string; topic: string }): string {
  return `${normalizeString(subject)}|${toTopicKey(topic)}`;
}

/** One of a skill's notice topics, as the planner weighs it: which one, and how often it's asked. */
export type ScoredTopic = { key: string; score: number };

/** A topic the exam asks most ("Cai bastante"). */
function isMostAsked(topic: ScoredTopic): boolean {
  return topic.score === LEVEL_SCORES.high;
}

/**
 * Each skill's notice topics, scored by how often the exam asks them (`levels`); a topic nothing
 * rates counts as the middle.
 */
export function scoreSkillTopics({
  graph,
  levels,
}: {
  graph: PlanGraph;
  levels: readonly TopicLevel[];
}): Map<string, ScoredTopic[]> {
  const scores = new Map(levels.map((level) => [toKey(level), LEVEL_SCORES[level.level]]));

  return new Map(
    graph.skills.map((skill) => [
      skill.skillId,
      (skill.topics ?? []).map((topic) => {
        const key = toKey({ subject: skill.area ?? "", topic });
        return { key, score: scores.get(key) ?? UNRATED_SCORE };
      }),
    ]),
  );
}

/** A skill that teaches none of the notice's topics: the exam doesn't ask it. */
const NOT_ASKED_SCORE = 0;

/**
 * How often the exam asks each skill's most asked topic (see `scoreSkillTopics`), a skill that
 * teaches none of the notice's topics scoring below every topic it lists: a plan short on time
 * cuts the depth of the least asked first, and a skill asked less than a topic built on it is one
 * of the plan's bases (see `findPlanBases`).
 */
export function getAskedScore(
  topics: ReadonlyMap<string, readonly ScoredTopic[]>,
): (skillId: string | null) => number {
  return (skillId) => {
    const scores = (topics.get(skillId ?? "") ?? []).map((topic) => topic.score);
    return scores.length > 0 ? Math.max(...scores) : NOT_ASKED_SCORE;
  };
}

/**
 * The skills that teach a topic the exam asks most ("Appears a lot", or a teacher's "ALWAYS ON THE TEST"):
 * one the learner already knows keeps its practice whatever the time (see `loadPracticeClaims`).
 */
export function findFrequentSkillIds({
  graph,
  levels,
}: {
  graph: PlanGraph;
  levels: readonly TopicLevel[];
}): Set<string> {
  const scored = scoreSkillTopics({ graph, levels });

  return new Set(
    [...scored]
      .filter(([, topics]) => topics.some((topic) => isMostAsked(topic)))
      .map(([skillId]) => skillId),
  );
}

/** A skill's score: that of the most asked topic it teaches, or null when none is rated. */
function scoreSkill({
  scores,
  skill,
}: {
  scores: ReadonlyMap<string, number>;
  skill: PlanGraphSkill;
}): number | null {
  const area = skill.area ?? "";

  const rated = (skill.topics ?? []).flatMap((topic) => {
    const score = scores.get(toKey({ subject: area, topic }));
    return score === undefined ? [] : [score];
  });

  return rated.length > 0 ? Math.max(...rated) : null;
}

/** The skill's exam weight times its score, scaled so its area keeps its weight in all. */
function weighArea(skills: readonly { score: number | null; skill: PlanGraphSkill }[]) {
  if (skills.every(({ score }) => score === null)) {
    return skills.map(({ skill }) => skill);
  }

  const parts = skills.map(({ score, skill }) => ({
    mass: (skill.weight ?? 1) * skill.lessons,
    score: score ?? UNRATED_SCORE,
    skill,
  }));

  const total = parts.reduce((sum, part) => sum + part.mass, 0);
  const scored = parts.reduce((sum, part) => sum + part.mass * part.score, 0);
  const scale = scored > 0 ? total / scored : 1;

  return parts.map(({ score, skill }) => ({
    ...skill,
    weight: (skill.weight ?? 1) * score * scale,
  }));
}

/**
 * The graph with each skill's exam weight scaled, inside its subject, by how often the exam asks
 * the topics it teaches (`levels`: its past papers, or a lookup of them): genetics, which ENEM asks
 * every year, counts more than gravitation, which it rarely does. Each subject keeps its weight in
 * all, so its share of the plan's time stays what its questions are worth; inside it, a plan short
 * on time leaves out the topics asked least first and gives the ones asked most their depth first.
 * Subjects whose topics nothing rates keep their weights. The stored graph never changes: only the
 * planner reads the weighted copy.
 */
export function weighGraphByTopicFrequency({
  graph,
  levels,
}: {
  graph: PlanGraph;
  levels: readonly TopicLevel[];
}): PlanGraph {
  if (levels.length === 0) {
    return graph;
  }

  const scores = new Map(levels.map((level) => [toKey(level), LEVEL_SCORES[level.level]]));
  const scored = graph.skills.map((skill) => ({ score: scoreSkill({ scores, skill }), skill }));
  const byArea = Map.groupBy(scored, ({ skill }) => skill.area ?? "");

  const weighed = new Map(
    [...byArea.values()].flatMap((skills) =>
      weighArea(skills).map((skill) => [skill.skillId, skill] as const),
    ),
  );

  return { ...graph, skills: graph.skills.map((skill) => weighed.get(skill.skillId) ?? skill) };
}
