import { getFullCourseFinishDate } from "../planner/after-exam";
import { toIsoDate } from "../planner/plan-calendar";
import {
  type PlanEffect,
  asDeferredTeaching,
  getFittedStandInLessons,
  getSeenChange,
} from "../planner/plan-effect";
import { type PlanGraph } from "../planner/plan-state";
import { getCourseFinish, getDatedFinish } from "./course-finish";
import { type ContextPlanItem } from "./plan-context";
import { type ComputedPlan } from "./replan";

type CountedItem = { lessonId: string | null; lessons?: number | null; skillId: string | null };

export function getChangeFinish({ plan, today }: { plan: ComputedPlan; today: Date }) {
  const finish = getCourseFinish(plan);

  if (finish) {
    return finish;
  }

  if (plan.state.settings.fullCourse) {
    const date = getFullCourseFinishDate(plan);
    return date ? getDatedFinish({ date, today }) : null;
  }

  const { endDate } = plan.feasibility;
  return endDate ? getDatedFinish({ date: toIsoDate(endDate), today }) : null;
}

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
  fallback,
  savedGraph,
  shown,
}: {
  computed: ComputedPlan;
  fallback?: ComputedPlan;
  savedGraph?: PlanGraph;
  shown: readonly ContextPlanItem[];
}): PlanEffect {
  const baseline = fallback ?? computed;
  const shownLessons = new Set(shown.flatMap((item) => item.lessonId ?? []));

  const deferredCounts = new Map(
    savedGraph?.skills.map((skill) => [skill.skillId, skill.deferredLessons ?? 0]),
  );

  const deferredBefore = asDeferredTeaching(baseline.built.deferredTeaching).flatMap((item) => {
    const left = deferredCounts.get(item.skillId ?? "") ?? 0;
    const lessons = Math.min(left, item.lessons);

    if (lessons === 0 || (item.lessonId && shownLessons.has(item.lessonId))) {
      return [];
    }

    deferredCounts.set(item.skillId ?? "", left - lessons);
    return [{ ...item, lessons }];
  });

  return getSeenChange({
    after: [...computed.built.items, ...asDeferredTeaching(computed.built.deferredTeaching)],
    before: [...shown, ...deferredBefore],
    graph: joinGraphs({ computed, fallback: baseline }),
    ...getLessonCounters({ computed, fallback: baseline }),
  });
}

function sizeBy(sizes: ReadonlyMap<string, number>) {
  return (item: CountedItem) =>
    item.lessonId ? 1 : (item.lessons ?? sizes.get(item.skillId ?? "") ?? 1);
}

export function getBuiltChange({
  after,
  before,
}: {
  after: ComputedPlan;
  before: ComputedPlan;
}): PlanEffect {
  return getSeenChange({
    after: [...after.built.items, ...asDeferredTeaching(after.built.deferredTeaching)],
    before: [...before.built.items, ...asDeferredTeaching(before.built.deferredTeaching)],
    graph: joinGraphs({ computed: after, fallback: before }),
    lessonsAfter: sizeBy(fitStandIns(after)),
    lessonsBefore: sizeBy(fitStandIns(before)),
  });
}
