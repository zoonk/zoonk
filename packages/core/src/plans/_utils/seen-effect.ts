import { type PlanEffect, getFittedStandInLessons, getSeenChange } from "../planner/plan-effect";
import { type PlanGraph } from "../planner/plan-state";
import { type ContextPlanItem } from "./plan-context";
import { type ComputedPlan } from "./replan";

type CountedItem = { lessonId: string | null; lessons?: number | null; skillId: string | null };

function fitStandIns(plan: ComputedPlan): Map<string, number> {
  return getFittedStandInLessons({
    skillMinutes: plan.built.skillMinutes,
    standInLessons: plan.standInLessons,
  });
}

export function getLessonCounters({
  computed,
  fallback,
}: {
  computed: ComputedPlan;
  fallback: ComputedPlan;
}) {
  const [after, before] = [fitStandIns(computed), fitStandIns(fallback)];

  return {
    lessonsAfter: sizeBy(after),
    lessonsBefore: (item: CountedItem) =>
      item.lessonId ? 1 : (item.lessons ?? sizeBy(before)(item)),
  };
}

function joinGraphs({ computed, fallback }: { computed: ComputedPlan; fallback: ComputedPlan }) {
  const { graph } = computed.state;
  const own = new Set(graph.skills.map((skill) => skill.skillId));

  return {
    ...graph,
    skills: [
      ...graph.skills,
      ...fallback.state.graph.skills.filter((skill) => !own.has(skill.skillId)),
    ],
  } satisfies PlanGraph;
}

export function getSeenEffect({
  computed,
  fallback = computed,
  shown,
}: {
  computed: ComputedPlan;
  fallback?: ComputedPlan;
  shown: readonly ContextPlanItem[];
}): PlanEffect {
  return getSeenChange({
    after: computed.built.items,
    before: shown,
    graph: joinGraphs({ computed, fallback }),
    ...getLessonCounters({ computed, fallback }),
  });
}

function sizeBy(sizes: ReadonlyMap<string, number>) {
  return (item: CountedItem) => (item.lessonId ? 1 : (sizes.get(item.skillId ?? "") ?? 1));
}

export function getBuiltChange({
  after,
  before,
}: {
  after: ComputedPlan;
  before: ComputedPlan;
}): PlanEffect {
  return getSeenChange({
    after: after.built.items,
    before: before.built.items,
    graph: joinGraphs({ computed: after, fallback: before }),
    lessonsAfter: sizeBy(fitStandIns(after)),
    lessonsBefore: sizeBy(fitStandIns(before)),
  });
}
