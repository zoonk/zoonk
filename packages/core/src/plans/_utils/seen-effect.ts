import { type PlanEffect, getFittedStandInLessons, getSeenChange } from "../planner/plan-effect";
import { type PlanGraph } from "../planner/plan-state";
import { type ContextPlanItem } from "./plan-context";
import { type ComputedPlan } from "./replan";

type CountedItem = { lessonId: string | null; lessons?: number | null; skillId: string | null };

/** The lessons of each of a plan's stand-ins that fit before its deadline. */
function fitStandIns(plan: ComputedPlan): Map<string, number> {
  return getFittedStandInLessons({
    skillMinutes: plan.built.skillMinutes,
    standInLessons: plan.standInLessons,
  });
}

/**
 * How many lessons each side's lesson items are: one for a lesson; a stand-in in the plan the
 * learner sees as many as it was saved with (else as many as fit in `fallback`, the plan planned
 * again as it was), and in the new plan the part of it that fits, so a skill a change only starts
 * counts the lessons it brings in, not all of them.
 */
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

/** The graph of both plans, so a skill only one of them has still names its topics. */
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

/**
 * What a planning run (`computed`) changes in the plan the learner sees (`shown`, as saved), as
 * every card reads it (see `getSeenChange`). Read against a plan planned again instead, a topic an
 * earlier run had already left out was said to "leave" (Lucas's "Origin and evolution", out of his
 * plan before his change). `fallback` sizes the stand-ins saved without a size.
 */
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

/** Sizes a stand-in as `sizes` say, a lesson as one. */
function sizeBy(sizes: ReadonlyMap<string, number>) {
  return (item: CountedItem) => (item.lessonId ? 1 : (sizes.get(item.skillId ?? "") ?? 1));
}

/**
 * What a plan (`after`) would change in the one a run saves (`before`), each side's stand-ins sized
 * as its save stores them, so a proposal's card says what applying it records against that save.
 */
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
