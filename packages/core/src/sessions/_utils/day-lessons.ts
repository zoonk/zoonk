import { type Goal, type PlanItem } from "@zoonk/db";
import { readSelectedItemFacts } from "../../plans/_utils/selected-item-contract";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { LEARN_KINDS, hasUnwrittenSkill } from "../../plans/planner/plan-item-rules";
import { type PlanGraph } from "../../plans/planner/plan-state";

const LESSON_LOOKAHEAD = 8;

/** A lesson takes at least a minute, so a day can't hold more lessons than its minutes. */
export function getLessonLookahead(dayMinutes: number): number {
  return Math.max(LESSON_LOOKAHEAD, Math.ceil(dayMinutes));
}

type DayItem = Pick<PlanItem, "chapterId" | "lessonId" | "scheduledFor" | "skillId"> &
  Partial<Pick<PlanItem, "facts" | "lessons">>;

function isDue({ item, today }: { item: DayItem; today: Date }): boolean {
  return item.scheduledFor !== null && item.scheduledFor <= today;
}

/** Include every day of a producer's consumed interval, not only its first scheduled date. */
function isAllocatedOn({ item, today }: { item: DayItem; today: Date }): boolean {
  if (item.scheduledFor === null || isDue({ item, today })) {
    return true;
  }

  const facts = readSelectedItemFacts(item.facts);
  const date = toIsoDate(today);
  return facts?.days?.some(([day, , raw]) => day === date && raw > 0) === true;
}

function getDayShares<TItem extends DayItem>({
  graph,
  items,
  today,
}: {
  graph: PlanGraph;
  items: readonly TItem[];
  today: Date;
}): Map<string | null, number> {
  const areas = new Map(graph.skills.map((skill) => [skill.skillId, skill.area]));

  return items
    .filter((item) => isDue({ item, today }))
    .reduce((shares, item) => {
      const area = areas.get(item.skillId ?? "") ?? null;
      const lessons = hasUnwrittenSkill(item) ? (item.lessons ?? 1) : 1;
      return shares.set(area, (shares.get(area) ?? 0) + lessons);
    }, new Map<string | null, number>());
}

/** Unwritten subjects retain time for practice unless their skills have no askable questions or voiced recordings. */
function listHeldAreas<TItem extends DayItem>({
  graph,
  idleSkillIds,
  items,
  today,
}: {
  graph: PlanGraph;
  idleSkillIds: ReadonlySet<string>;
  items: readonly TItem[];
  today: Date;
}): string[] {
  const areas = new Map(graph.skills.map((skill) => [skill.skillId, skill.area]));
  const areaOf = (item: DayItem) => areas.get(item.skillId ?? "") ?? null;

  const written = new Set(
    items.filter((item) => !hasUnwrittenSkill(item)).map((item) => areaOf(item)),
  );

  const practiced = new Set(
    graph.skills.filter((skill) => !idleSkillIds.has(skill.skillId)).map((skill) => skill.area),
  );

  return [...getDayShares({ graph, items, today }).keys()].flatMap((area) =>
    area !== null && !written.has(area) && practiced.has(area) ? [area] : [],
  );
}

/** An unwritten prerequisite must hold back later lessons instead of letting the day reach arbitrarily far ahead. */
function listOpenLessons<TItem extends DayItem>({
  items,
  prerequisites,
}: {
  items: readonly TItem[];
  prerequisites: ReadonlyMap<string, readonly string[]>;
}): TItem[] {
  const waiting = new Set<string | null>();
  const written = new Set<string | null>();

  return items.filter((item) => {
    if (hasUnwrittenSkill(item)) {
      waiting.add(item.skillId);
      return false;
    }

    const blocked = (prerequisites.get(item.skillId ?? "") ?? []).some(
      (skillId) => waiting.has(skillId) && !written.has(skillId),
    );

    (blocked ? waiting : written).add(item.skillId);
    return !blocked;
  });
}

/** Preserve each exam subject's time; pending outlines must not let later lessons consume the time they will need. */
function pickDayLessonItems<TItem extends DayItem>({
  awaitingOutlines,
  graph,
  idleSkillIds = new Set(),
  isExam,
  items,
  prerequisites = new Map(),
  today,
}: {
  /** Lessons due by today are still being outlined: the day holds their time. */
  awaitingOutlines: boolean;
  graph: PlanGraph;
  /** Skills practice has nothing to ask today (see `listHeldAreas`). */
  idleSkillIds?: ReadonlySet<string>;
  isExam: boolean;
  items: readonly TItem[];
  prerequisites?: ReadonlyMap<string, readonly string[]>;
  today: Date;
}): readonly TItem[] {
  const lessons = listOpenLessons({ items, prerequisites });
  const due = lessons.filter((item) => isDue({ item, today }));

  if (awaitingOutlines) {
    return due;
  }

  if (!isExam || due.length === 0) {
    return lessons;
  }

  const areas = new Map(graph.skills.map((skill) => [skill.skillId, skill.area]));
  const areaOf = (item: DayItem) => areas.get(item.skillId ?? "") ?? null;
  const shares = getDayShares({ graph, items, today });

  const later = lessons.filter((item) => !due.includes(item) && shares.has(areaOf(item)));

  if (listHeldAreas({ graph, idleSkillIds, items, today }).length === 0) {
    return [...due, ...later];
  }

  const room = new Map(
    [...shares].map(([area, share]) => [
      area,
      share - due.filter((item) => areaOf(item) === area).length,
    ]),
  );

  const refills = later.filter((item, index) => {
    const area = areaOf(item);
    const before = later.slice(0, index).filter((other) => areaOf(other) === area).length;

    return before < (room.get(area) ?? 0);
  });

  return [...due, ...refills];
}

/** Hold time for pending lessons before allocating it to practice on their skills. */
function listHeldSkillIds<TItem extends DayItem>({
  awaitingOutlines,
  graph,
  idleSkillIds = new Set(),
  isExam,
  items,
  today,
}: {
  awaitingOutlines: boolean;
  graph: PlanGraph;
  /** Skills practice has nothing to ask today (see `listHeldAreas`). */
  idleSkillIds?: ReadonlySet<string>;
  isExam: boolean;
  items: readonly TItem[];
  today: Date;
}): Set<string> {
  const held = new Set(
    isExam && !awaitingOutlines ? listHeldAreas({ graph, idleSkillIds, items, today }) : [],
  );

  return new Set(
    graph.skills
      .filter(
        (skill) => skill.area !== null && held.has(skill.area) && !idleSkillIds.has(skill.skillId),
      )
      .map((skill) => skill.skillId),
  );
}

/** Returns lessons in plan order and held-subject skills for priority practice. */
export function pickDayLessons<TItem extends DayItem & Pick<PlanItem, "kind" | "status">>({
  awaitingOutlines,
  goal,
  heldDay = false,
  localDate,
  plan,
}: {
  awaitingOutlines: boolean;
  /** A shown day must retain its selected allocation instead of refilling from future work. */
  heldDay?: boolean;
  goal: Pick<Goal, "kind">;
  localDate: Date;
  plan: {
    graph: PlanGraph;
    /** Skills practice has nothing to ask today (see `listHeldAreas`). */
    idleSkillIds?: ReadonlySet<string>;
    items: readonly TItem[];
    prerequisites?: ReadonlyMap<string, readonly string[]>;
  };
}) {
  const day = {
    awaitingOutlines,
    graph: plan.graph,
    idleSkillIds: plan.idleSkillIds,
    isExam: goal.kind === "exam",
    items: plan.items.filter((item) => LEARN_KINDS.has(item.kind) && item.status === "todo"),
    today: localDate,
  };

  return {
    heldSkillIds: listHeldSkillIds(day),
    learnItems: heldDay
      ? listOpenLessons({
          items: day.items,
          prerequisites: plan.prerequisites ?? new Map(),
        }).filter((item) => isAllocatedOn({ item, today: localDate }))
      : pickDayLessonItems({ ...day, prerequisites: plan.prerequisites }),
  };
}
