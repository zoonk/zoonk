import {
  type PlanEffect,
  countLessonChanges,
  getFittedStandInLessons,
  getTopicChanges,
  listLessonsLeftOut,
} from "../planner/plan-effect";
import { type PlanGraph } from "../planner/plan-state";
import { type PlanContext } from "./plan-context";
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
    lessonsAfter: (item: CountedItem) => (item.lessonId ? 1 : (after.get(item.skillId ?? "") ?? 1)),
    lessonsBefore: (item: CountedItem) =>
      item.lessonId ? 1 : (item.lessons ?? before.get(item.skillId ?? "") ?? 1),
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
 * What a planning run (`computed`) changes in the plan the learner sees (`shown`, as saved): the
 * lessons it adds and leaves out, skill by skill, the ones it leaves out whole by name, and the
 * notice topics it brings in or leaves out. Read against a plan planned again instead, a topic an
 * earlier run had already left out was said to "leave" (Lucas's "Origin and evolution", out of his
 * plan before his change). `fallback` sizes the stand-ins a plan saved before it stored their size.
 */
export function getSeenEffect({
  computed,
  fallback = computed,
  shown,
}: {
  computed: ComputedPlan;
  fallback?: ComputedPlan;
  shown: PlanContext["items"];
}): Pick<
  PlanEffect,
  | "lessonsAdded"
  | "lessonsAddedEstimated"
  | "lessonsLeftOut"
  | "lessonsRemoved"
  | "topicsAdded"
  | "topicsLeftOut"
> {
  const after = computed.built.items;

  const lessons = countLessonChanges({
    after,
    before: shown,
    ...getLessonCounters({ computed, fallback }),
  });

  const lessonsLeftOut = listLessonsLeftOut({ after, before: shown });

  const topics = getTopicChanges({
    after,
    before: shown,
    graph: joinGraphs({ computed, fallback }),
  });

  return {
    ...lessons,
    ...(lessonsLeftOut.length > 0 && { lessonsLeftOut }),
    ...(topics.topicsAdded.length > 0 && { topicsAdded: topics.topicsAdded }),
    ...(topics.topicsLeftOut.length > 0 && { topicsLeftOut: topics.topicsLeftOut }),
  };
}

/**
 * A system change's effect (`computed.effect`) with the notice topics it brings into the plan the
 * learner sees (`shown`) or leaves out of it (see `getSeenEffect`): every change to which topics
 * the plan teaches names them. A test-out that brought topics in and missed days that left some
 * out said only how many lessons moved, or that the plan covers less.
 */
export function withSeenTopics({
  computed,
  shown,
}: {
  computed: ComputedPlan;
  shown: PlanContext["items"];
}): PlanEffect {
  const { topicsAdded, topicsLeftOut } = getSeenEffect({ computed, shown });

  return {
    ...computed.effect,
    ...(topicsAdded && { topicsAdded }),
    ...(topicsLeftOut && { topicsLeftOut }),
  };
}
