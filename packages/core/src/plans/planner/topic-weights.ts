import { normalizeString } from "@zoonk/utils/string";
import { type TopicLevel } from "../../library/exams/topic-frequency";
import { toTopicKey } from "../../library/exams/topic-key";
import { type PlanGraph, type PlanGraphSkill } from "./plan-state";

const LEVEL_SCORES: Record<TopicLevel["level"], number> = { high: 3, low: 1, medium: 2 };

const UNRATED_SCORE = LEVEL_SCORES.medium;

function toKey({ subject, topic }: { subject: string; topic: string }): string {
  return `${normalizeString(subject)}|${toTopicKey(topic)}`;
}

export type ScoredTopic = { key: string; score: number };

function isMostAsked(topic: ScoredTopic): boolean {
  return topic.score === LEVEL_SCORES.high;
}

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

const NOT_ASKED_SCORE = 0;

export function getAskedScore(
  topics: ReadonlyMap<string, readonly ScoredTopic[]>,
): (skillId: string | null) => number {
  return (skillId) => {
    const scores = (topics.get(skillId ?? "") ?? []).map((topic) => topic.score);
    return scores.length > 0 ? Math.max(...scores) : NOT_ASKED_SCORE;
  };
}

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
