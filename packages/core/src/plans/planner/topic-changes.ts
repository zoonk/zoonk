import { getSkillArea } from "./graph-areas";
import { type AreaTopics, type EffectItem } from "./plan-effect";
import { type PlanGraph } from "./plan-state";

function listPlannedTopics({
  graph,
  items,
}: {
  graph: PlanGraph;
  items: readonly Pick<EffectItem, "skillId" | "status">[];
}): Map<string, Set<string>> {
  const planned = new Set(
    items.flatMap((item) => (item.skillId && item.status !== "skipped" ? [item.skillId] : [])),
  );

  const mapsTopics = graph.skills.some((skill) => (skill.topics ?? []).length > 0);

  return graph.skills
    .filter((skill) => planned.has(skill.skillId))
    .reduce((areas, skill) => {
      const area = getSkillArea({ graph, skill });
      const topics = areas.get(area) ?? new Set<string>();
      (mapsTopics ? (skill.topics ?? []) : [skill.name]).forEach((topic) => topics.add(topic));
      return areas.set(area, topics);
    }, new Map<string, Set<string>>());
}

function listMissingTopics({
  from,
  graph,
  to,
}: {
  from: Map<string, Set<string>>;
  graph: PlanGraph;
  to: Map<string, Set<string>>;
}): AreaTopics[] {
  const areas = [...new Set(graph.skills.map((skill) => getSkillArea({ graph, skill })))];

  return areas.flatMap((area) => {
    const topics = [...(from.get(area) ?? [])].filter((topic) => !to.get(area)?.has(topic));
    return topics.length > 0 ? [{ area, topics }] : [];
  });
}

export function getTopicChanges({
  after,
  before,
  graph,
}: {
  after: readonly Pick<EffectItem, "skillId" | "status">[];
  before: readonly Pick<EffectItem, "skillId" | "status">[];
  graph: PlanGraph;
}): { topicsAdded: AreaTopics[]; topicsLeftOut: AreaTopics[] } {
  const was = listPlannedTopics({ graph, items: before });
  const now = listPlannedTopics({ graph, items: after });

  return {
    topicsAdded: listMissingTopics({ from: now, graph, to: was }),
    topicsLeftOut: listMissingTopics({ from: was, graph, to: now }),
  };
}
