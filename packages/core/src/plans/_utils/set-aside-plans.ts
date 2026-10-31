import { type PlanOperation } from "../plan-contract";
import { type ExistingPlanItem } from "../planner/plan-items";
import { type PlanGraph } from "../planner/plan-state";
import { getTopicChanges } from "../planner/topic-changes";

type TopicItem = Pick<ExistingPlanItem, "skillId" | "status">;

type PlannedChange = {
  computed: { built: { items: readonly TopicItem[] }; state: { graph: PlanGraph } };
};

export function plansSetAsideBothWays({
  items,
  operations,
}: {
  items: readonly ExistingPlanItem[];
  operations: readonly PlanOperation[];
}): boolean {
  return (
    operations.length > 0 &&
    operations.every((operation) => operation.kind === "setBaseChoices") &&
    items.some((item) => item.status === "skipped")
  );
}

function listLostTopics({
  plan,
  shown,
}: {
  plan: PlannedChange["computed"];
  shown: readonly TopicItem[];
}): Set<string> {
  const { topicsLeftOut } = getTopicChanges({
    after: plan.built.items,
    before: shown,
    graph: plan.state.graph,
  });

  return new Set(
    topicsLeftOut.flatMap(({ area, topics }) => topics.map((topic) => `${area}|${topic}`)),
  );
}

export function pickSetAsidePlans<Planned extends PlannedChange>({
  brought,
  kept,
  shown,
}: {
  brought: Planned;
  kept: Planned;
  shown: readonly TopicItem[];
}): Planned & { bringsBackSetAside: boolean } {
  const lostBrought = listLostTopics({ plan: brought.computed, shown });
  const lostKept = listLostTopics({ plan: kept.computed, shown });

  const keepsMore =
    lostKept.size < lostBrought.size && [...lostKept].every((topic) => lostBrought.has(topic));

  return keepsMore
    ? { ...kept, bringsBackSetAside: false }
    : { ...brought, bringsBackSetAside: true };
}
