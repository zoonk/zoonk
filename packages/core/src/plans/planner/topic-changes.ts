import { getSkillArea } from "./graph-areas";
import { type AreaTopics, type EffectItem } from "./plan-effect";
import { type PlanGraph } from "./plan-state";

/**
 * Each area's topics the plan teaches: a topic is in when any of its skills has an item. A graph
 * that maps no topics (a career's, a language's) names its skills instead, so what leaves or comes
 * into its plan is said too.
 */
function listPlannedTopics({
  graph,
  items,
}: {
  graph: PlanGraph;
  items: readonly Pick<EffectItem, "skillId" | "status">[];
}): Map<string, Set<string>> {
  // An item set aside for time (`skipped`) is out of the plan.
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

/** Each area's topics in `from` and not in `to`, in the graph's order. */
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

/**
 * The notice topics a change brings into the plan and the ones it leaves out, by subject, so what
 * a learner is told about it ("physics keeps its basics") is read from what it does: a topic is in
 * the plan while any skill that teaches it has a lesson there. A graph that doesn't map topics
 * names its skills (see `listPlannedTopics`).
 */
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
