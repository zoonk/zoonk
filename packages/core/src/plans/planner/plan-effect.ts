import { getSkillArea } from "./graph-areas";
import { type NextMockMove } from "./next-mock-move";
import { daysBetween, fromIsoDate, toIsoDate } from "./plan-calendar";
import { SMALL_CHANGE_DAYS, SMALL_CHANGE_LESSONS } from "./plan-change-thresholds";
import { type PlannedItem, getItemKey } from "./plan-items";
import { type PlanGraph } from "./plan-state";
import { type PlannedMocks } from "./planned-mocks";
import { type SkillMinutes } from "./skill-minutes";

export type EffectItem = Pick<
  PlannedItem,
  "chapterId" | "kind" | "lessonId" | "phase" | "scheduledFor" | "skillId" | "status"
> & { id: string | null };

/** When a focused area's first lesson is due, before and after a change. */
export type AreaStart = { after: string | null; area: string; before: string | null };

/**
 * When an area a change gives more or less time to has its last lesson, before and after it, and
 * the lessons still to do it gains (fewer when negative) when those move by more than rounding:
 * short on time, a focus brings more of an area in, which can end it later.
 */
export type AreaEnd = { after: string; area: string; before: string; lessonsGained?: number };

/** How many lessons an area has still to do, before and after a change. */
export type AreaLessons = { after: number; area: string; before: number };

/** Notice topics of one subject (a plan area), in the notice's own words. */
export type AreaTopics = { area: string; topics: string[] };

/**
 * The weekday (0 for Sunday) the week's mocks (an exam's) or challenges move to, and the one they
 * were on, when a change to the learner's days moves them.
 */
export type WeeklyEventMove = { after: number; before: number; kind: "challenge" | "mock" };

/** A review day ahead that a focus opens with its areas (or the parts of them it names). */
type ReviewFirst = { areas: string[]; date: string };

/**
 * A phase whose end date a change moves: the one it ends on after the change, and before it.
 * `restDay`: the end the learner saw falls on a day they rest, where its challenge stays until the
 * dates move. `lessonsFirst`: lessons its challenge tests took longer than planned and come after
 * it on that end; the move puts the challenge after them.
 */
export type PhaseEndMove = {
  after: string;
  before: string;
  lessonsFirst?: true;
  name: string;
  restDay?: true;
};

/**
 * What a change does to what's left: lessons added or removed, when the plan ends, when the topics
 * the learner adds start, for a focus, when each focused area now starts and the review day ahead
 * it opens, the notice topics it brings into the plan or leaves out of it (see
 * `getTopicChanges`), the day the week's mock or challenge moves to, and the phases it moves the
 * end of.
 */
export type PlanEffect = {
  /** For topics the learner adds: they come before lessons of the plan's first phase. */
  addedTopicsBeforeBasics?: true;
  /** For topics the learner adds: the day the first of their lessons is due with the change. */
  addedTopicsStart?: string;
  /**
   * For more or less time on some areas: when each one whose end moves has its last lesson, after
   * the change and before it (see `getAreaEnds`).
   */
  areaEnds?: AreaEnd[];
  /**
   * For more or less time on some areas: each area the change doesn't name whose lessons still to
   * do move by more than rounding (see `getUnnamedAreaLessons`).
   */
  areaLessons?: AreaLessons[];
  areaStarts?: AreaStart[];
  /**
   * For a plan planned again as placement ended (`coverageChanged`): the learner's placement
   * answers moved the topics, so the card says it was them (see `replanAfterPlacement`).
   */
  fromPlacement?: true;
  reviewFirst?: ReviewFirst;
  endDateAfter: string | null;
  endDateBefore: string | null;
  lessonsAdded: number;
  /**
   * Some of the lessons it adds aren't written yet: their count is the plan's estimate for their
   * topic, which the Library's lessons can differ from, so the card says "about" (Pedro's said 8
   * lessons for a topic the Library wrote 5 for).
   */
  lessonsAddedEstimated?: true;
  /**
   * The lessons of the plan the learner sees that the change leaves out whole, by title, in the
   * plan's order (see `listLessonsLeftOut`), so a card names what leaves.
   */
  lessonsLeftOut?: string[];
  lessonsRemoved: number;
  /**
   * For placement's answers (`testedOut`, or `coverageChanged` with `fromPlacement`): the exam's
   * listening areas its text answers started past their basics (see `listPlacementListeningAreas`),
   * so the card says why their basics left and that practice with recordings checks them.
   */
  listeningPastBasics?: string[];
  /** For an exam's plan: the day its next mock moves to (see `getNextMockMove`). */
  nextMock?: NextMockMove;
  /**
   * For moving the phase dates (`fitPhaseDates`): the goal's outcome skills (a career's job search)
   * keeping the dates leaves out by the goal's date and moving them fits in, by name.
   */
  outcomesAdded?: string[];
  /**
   * For moving the phase dates (`fitPhaseDates`): each phase that would end on another day; for a
   * missed day's settling (`missedDays`), each phase whose end it moved.
   */
  phaseEnds?: PhaseEndMove[];
  topicsAdded?: AreaTopics[];
  topicsLeftOut?: AreaTopics[];
  weeklyEvents?: WeeklyEventMove;
} & Pick<PlannedMocks, "practiceFunding" | "selectionShifts">;

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

/** A lesson still to do that stands in for its skill's lessons the Library hasn't written yet. */
function isStandIn(item: Pick<EffectItem, "kind" | "lessonId" | "status">): boolean {
  return item.status === "todo" && item.kind === "lesson" && !item.lessonId;
}

/**
 * Whether some of the lessons `from` gains over `to` are a stand-in's (`standIns`, by key): a
 * count the Library's lessons can differ from (see `PlanEffect.lessonsAddedEstimated`).
 */
function gainsStandIns({
  from,
  standIns,
  to,
}: {
  from: Map<string, number>;
  standIns: ReadonlySet<string>;
  to: Map<string, number>;
}): Pick<PlanEffect, "lessonsAddedEstimated"> {
  const estimated = [...from].some(
    ([key, lessons]) => standIns.has(key) && lessons > (to.get(key) ?? 0),
  );

  return estimated ? { lessonsAddedEstimated: true } : {};
}

/** The share of minutes the plan covers: the stand-in's own when there is one, else its skill's. */
function getCoveredShare(skill: SkillMinutes): number {
  const { covered, total } = skill.standIn ?? skill;
  return total > 0 ? covered / total : 1;
}

/**
 * The lessons of each skill's stand-in that fit before the deadline: its share of its minutes the
 * plan covers. A stand-in of 32 lessons that fits a few of them adds a few, not 32; one whose
 * skill's written lessons took the time the plan has for it fits about none of them.
 */
export function getFittedStandInLessons({
  skillMinutes,
  standInLessons,
}: {
  skillMinutes: readonly SkillMinutes[];
  standInLessons: ReadonlyMap<string, number>;
}): Map<string, number> {
  const shares = new Map(skillMinutes.map((skill) => [skill.skillId, getCoveredShare(skill)]));

  return new Map(
    [...standInLessons].map(([skillId, lessons]) => [
      skillId,
      Math.max(1, Math.round(lessons * (shares.get(skillId) ?? 1))),
    ]),
  );
}

/**
 * The day the first lesson of the skills a change adds is due, so the card says when the topics
 * the learner asked for start; null when the plan doesn't reach them.
 */
export function getAddedSkillsStart({
  items,
  skillIds,
}: {
  items: readonly EffectItem[];
  skillIds: ReadonlySet<string>;
}): string | null {
  const dates = items.flatMap((item) =>
    item.status === "todo" && item.scheduledFor && skillIds.has(item.skillId ?? "")
      ? [item.scheduledFor.getTime()]
      : [],
  );

  return dates.length > 0 ? toIsoDate(new Date(Math.min(...dates))) : null;
}

/**
 * Whether the skills a change adds come before every lesson of the plan's first phase still to
 * do: topics the learner asked to start now go ahead of the basics, and the card says so.
 */
export function startsBeforeBasics({
  items,
  skillIds,
}: {
  items: readonly EffectItem[];
  skillIds: ReadonlySet<string>;
}): boolean {
  const lessons = items.filter((item) => item.status === "todo" && item.kind === "lesson");
  const added = lessons.findIndex((item) => skillIds.has(item.skillId ?? ""));

  const basics = lessons.findIndex((item) => item.phase === 0 && !skillIds.has(item.skillId ?? ""));

  return added !== -1 && basics !== -1 && added < basics;
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

  const standIns = new Set(
    after
      .filter((item) => isStandIn(item))
      .map((item) => getItemKey({ ...item, id: item.id ?? "" })),
  );

  return {
    endDateAfter: getEndDate(after),
    endDateBefore: getEndDate(before),
    lessonsAdded: countGained({ from: afterLessons, to: beforeLessons }),
    ...gainsStandIns({ from: afterLessons, standIns, to: beforeLessons }),
    lessonsRemoved: countGained({ from: beforeLessons, to: afterLessons }),
  };
}

/** A plan item as the learner sees it in their plan: what it is, its skill and its title. */
type SeenItem = Pick<EffectItem, "chapterId" | "kind" | "lessonId" | "skillId" | "status"> & {
  titleSnapshot: string;
};

/** Each skill's lessons still to do: one for each lesson, and a stand-in's as `lessonsOf` says. */
function countSkillLessons({
  items,
  lessonsOf,
}: {
  items: readonly SeenItem[];
  lessonsOf: (item: SeenItem) => number;
}): Map<string, number> {
  return items
    .filter((item) => item.status === "todo" && item.kind === "lesson")
    .reduce(
      (skills, item) =>
        skills.set(item.skillId ?? "", (skills.get(item.skillId ?? "") ?? 0) + lessonsOf(item)),
      new Map<string, number>(),
    );
}

/**
 * The lessons a change adds to the plan the learner sees (`before`) and leaves out of it, skill by
 * skill: lessons written for a skill since its stand-in was saved are the same lessons, so only
 * what a skill gains or loses counts. A lesson both plans hold counts under the skill the learner
 * sees it under: a lesson two skills share, filed under the other one by the new plan, read as
 * one left out and one added (Maya's "Study everything" left out 1). `lessonsBefore` and
 * `lessonsAfter` say how many lessons each side's stand-ins teach; a skill that gains lessons while
 * a stand-in holds some of them makes the count an estimate.
 */
export function countLessonChanges({
  after,
  before,
  lessonsAfter,
  lessonsBefore,
}: {
  after: readonly SeenItem[];
  before: readonly SeenItem[];
  lessonsAfter: (item: SeenItem) => number;
  lessonsBefore: (item: SeenItem) => number;
}): Pick<PlanEffect, "lessonsAdded" | "lessonsAddedEstimated" | "lessonsRemoved"> {
  const seenSkills = new Map(
    before.flatMap((item) => (item.lessonId ? [[item.lessonId, item.skillId] as const] : [])),
  );

  const filed = after.map((item) =>
    item.lessonId && seenSkills.has(item.lessonId)
      ? { ...item, skillId: seenSkills.get(item.lessonId) ?? item.skillId }
      : item,
  );

  const was = countSkillLessons({ items: before, lessonsOf: lessonsBefore });
  const now = countSkillLessons({ items: filed, lessonsOf: lessonsAfter });

  const standIns = new Set(
    filed.filter((item) => isStandIn(item)).map((item) => item.skillId ?? ""),
  );

  return {
    lessonsAdded: countGained({ from: now, to: was }),
    ...gainsStandIns({ from: now, standIns, to: was }),
    lessonsRemoved: countGained({ from: was, to: now }),
  };
}

/**
 * The lessons of the plan the learner sees (`before`) that a change leaves out whole, by title, in
 * its order: a lesson the new plan doesn't have or sets aside, and a skill's lessons not written yet
 * (its stand-in) when nothing of that skill stays. A stand-in that only shrinks, or whose lessons were
 * written meanwhile, isn't left out.
 */
export function listLessonsLeftOut({
  after,
  before,
}: {
  after: readonly SeenItem[];
  before: readonly SeenItem[];
}): string[] {
  const lessons = after.filter((item) => item.kind === "lesson" && item.status !== "skipped");
  const lessonIds = new Set(lessons.flatMap((item) => (item.lessonId ? [item.lessonId] : [])));
  const skillIds = new Set(lessons.flatMap((item) => (item.skillId ? [item.skillId] : [])));

  return before
    .filter((item) => item.kind === "lesson" && item.status === "todo")
    .filter((item) =>
      item.lessonId ? !lessonIds.has(item.lessonId) : !skillIds.has(item.skillId ?? ""),
    )
    .map((item) => item.titleSnapshot);
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
