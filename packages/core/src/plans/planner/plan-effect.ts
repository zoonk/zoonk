import { getSkillArea } from "./graph-areas";
import { daysBetween, fromIsoDate, toIsoDate } from "./plan-calendar";
import { type PlannedItem, getItemKey } from "./plan-items";
import { type PlanGraph } from "./plan-state";

type EffectItem = Pick<
  PlannedItem,
  "chapterId" | "kind" | "lessonId" | "phase" | "scheduledFor" | "skillId" | "status"
> & { id: string | null };

/** When a focused area's first lesson is due, before and after a change. */
export type AreaStart = { after: string | null; area: string; before: string | null };

/** Notice topics of one subject (a plan area), in the notice's own words. */
export type AreaTopics = { area: string; topics: string[] };

/**
 * The weekday (0 for Sunday) the week's mocks (an exam's) or challenges move to, and the one they
 * were on, when a change to the learner's days moves them.
 */
export type WeeklyEventMove = { after: number; before: number; kind: "challenge" | "mock" };

/** A review day ahead that a focus opens with its areas (or the parts of them it names). */
export type ReviewFirst = { areas: string[]; date: string };

/**
 * What a change does to what's left: lessons added or removed, when the plan ends, for a focus,
 * when each focused area now starts and the review day ahead it opens, the notice topics it brings
 * into the plan or leaves out of it (see `getTopicChanges`), and the day the week's mock or
 * challenge moves to.
 */
export type PlanEffect = {
  areaStarts?: AreaStart[];
  reviewFirst?: ReviewFirst;
  endDateAfter: string | null;
  endDateBefore: string | null;
  lessonsAdded: number;
  lessonsRemoved: number;
  topicsAdded?: AreaTopics[];
  topicsLeftOut?: AreaTopics[];
  weeklyEvents?: WeeklyEventMove;
};

/** A change is small when it moves at most one lesson and the end date by at most a day. */
const SMALL_CHANGE_LESSONS = 1;
const SMALL_CHANGE_DAYS = 1;

/**
 * A lesson item is one lesson; a stand-in counts the lessons it plans: the whole skill when no
 * lesson teaches it yet, the rest when the Library outlined part of it.
 */
function countItemLessons({
  item,
  standInLessons,
}: {
  item: Pick<EffectItem, "lessonId" | "skillId">;
  standInLessons: ReadonlyMap<string, number>;
}): number {
  return item.lessonId ? 1 : (standInLessons.get(item.skillId ?? "") ?? 1);
}

function getLessonCounts({
  items,
  standInLessons,
}: {
  items: readonly EffectItem[];
  standInLessons: ReadonlyMap<string, number>;
}) {
  return new Map(
    items
      .filter((item) => item.status === "todo" && item.kind === "lesson")
      .map((item) => [
        getItemKey({ ...item, id: item.id ?? "" }),
        countItemLessons({ item, standInLessons }),
      ]),
  );
}

function getEndDate(items: readonly EffectItem[]): string | null {
  const last = items
    .filter((item) => item.status === "todo" && item.scheduledFor)
    .map((item) => item.scheduledFor?.getTime() ?? 0)
    .reduce((latest, time) => Math.max(latest, time), 0);

  return last > 0 ? toIsoDate(new Date(last)) : null;
}

/** The lessons `from` has that `to` doesn't: whole items, and what a stand-in in both gained. */
function countGained({ from, to }: { from: Map<string, number>; to: Map<string, number> }) {
  return [...from].reduce(
    (total, [key, lessons]) => total + Math.max(0, lessons - (to.get(key) ?? 0)),
    0,
  );
}

/**
 * The lessons of each skill's stand-in that fit before the deadline: its share of the skill's
 * minutes the plan covers. A stand-in of 32 lessons that fits a few of them adds a few, not 32.
 */
export function getFittedStandInLessons({
  skillMinutes,
  standInLessons,
}: {
  skillMinutes: readonly { covered: number; skillId: string; total: number }[];
  standInLessons: ReadonlyMap<string, number>;
}): Map<string, number> {
  const shares = new Map(
    skillMinutes.map((skill) => [skill.skillId, skill.total > 0 ? skill.covered / skill.total : 1]),
  );

  return new Map(
    [...standInLessons].map(([skillId, lessons]) => [
      skillId,
      Math.max(1, Math.round(lessons * (shares.get(skillId) ?? 1))),
    ]),
  );
}

/** Compares what was left to do before a change with what is left after it. */
export function getPlanEffect({
  after,
  before,
  standInLessons,
  standInLessonsBefore = standInLessons,
}: {
  after: readonly EffectItem[];
  before: readonly EffectItem[];
  /** The lessons each skill's stand-in plans after, from `getStandInLessons` or what fits. */
  standInLessons: ReadonlyMap<string, number>;
  /** The same before, when the plans differ in what fits (see `getFittedStandInLessons`). */
  standInLessonsBefore?: ReadonlyMap<string, number>;
}): PlanEffect {
  const beforeLessons = getLessonCounts({ items: before, standInLessons: standInLessonsBefore });
  const afterLessons = getLessonCounts({ items: after, standInLessons });

  return {
    endDateAfter: getEndDate(after),
    endDateBefore: getEndDate(before),
    lessonsAdded: countGained({ from: afterLessons, to: beforeLessons }),
    lessonsRemoved: countGained({ from: beforeLessons, to: afterLessons }),
  };
}

/** Changes bigger than a lesson wait for the learner's OK before they apply. */
export function needsApproval(effect: PlanEffect): boolean {
  const { endDateAfter, endDateBefore } = effect;

  const shift =
    endDateAfter && endDateBefore
      ? Math.abs(daysBetween(fromIsoDate(endDateBefore), fromIsoDate(endDateAfter)))
      : Number(endDateAfter !== endDateBefore) * (SMALL_CHANGE_DAYS + 1);

  return (
    effect.lessonsAdded + effect.lessonsRemoved > SMALL_CHANGE_LESSONS || shift > SMALL_CHANGE_DAYS
  );
}

/** Each area's topics the plan teaches: a topic is in when any of its skills has an item. */
function listPlannedTopics({
  graph,
  items,
}: {
  graph: PlanGraph;
  items: readonly Pick<EffectItem, "skillId">[];
}): Map<string, Set<string>> {
  const planned = new Set(items.flatMap((item) => (item.skillId ? [item.skillId] : [])));

  return graph.skills
    .filter((skill) => planned.has(skill.skillId))
    .reduce((areas, skill) => {
      const area = getSkillArea({ graph, skill });
      const topics = areas.get(area) ?? new Set<string>();
      (skill.topics ?? []).forEach((topic) => topics.add(topic));
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
 * the plan while any skill that teaches it has a lesson there. Empty for graphs that don't map
 * topics.
 */
export function getTopicChanges({
  after,
  before,
  graph,
}: {
  after: readonly Pick<EffectItem, "skillId">[];
  before: readonly Pick<EffectItem, "skillId">[];
  graph: PlanGraph;
}): { topicsAdded: AreaTopics[]; topicsLeftOut: AreaTopics[] } {
  const was = listPlannedTopics({ graph, items: before });
  const now = listPlannedTopics({ graph, items: after });

  return {
    topicsAdded: listMissingTopics({ from: now, graph, to: was }),
    topicsLeftOut: listMissingTopics({ from: was, graph, to: now }),
  };
}
