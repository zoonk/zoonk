import { type PlanOperation } from "../plan-contract";
import { type ExistingPlanItem } from "../planner/plan-items";
import { type PlanGraph } from "../planner/plan-state";
import { getTopicChanges } from "../planner/topic-changes";

type TopicItem = Pick<ExistingPlanItem, "skillId" | "status">;

/** A change planned next to the plan re-planned the same way without it (see `planWithAndWithout`). */
type PlannedChange = {
  computed: { built: { items: readonly TopicItem[] }; state: { graph: PlanGraph } };
};

/**
 * Whether a change is planned both bringing back work set aside for time and leaving it out: one
 * made only of base choices, on a plan that set some aside (see `pickSetAsidePlans`).
 */
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

/** The notice topics the plan the learner sees (`shown`) holds that `plan` leaves out. */
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

/**
 * On a change made only of base choices, work set aside for time comes back unless that costs a
 * topic the plan the learner sees holds (the lead, 10 Oct): the plans that leave it out (`kept`)
 * win over the ones that bring it back (`brought`) when they keep every topic the plan holds that
 * bringing it back keeps, and more. A class test's learner chose deep study for a base: cell
 * theory's lesson, set aside by missed days, came back in the nucleus's place. When leaving it out
 * costs a topic too, the work comes back, as on every other learner change (see
 * `getChangePlanning`): left out to keep logic's lesson, a Câmara plan lost four other topics.
 */
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
