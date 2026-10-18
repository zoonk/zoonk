import { type Goal, type PlanItem } from "@zoonk/db";
import { readSelectedItemFacts } from "../../plans/_utils/selected-item-contract";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { type PlanGraph } from "../../plans/planner/plan-state";
import { DEFAULT_LESSON_MINUTES } from "../../plans/planner/plan-units";

/** Upcoming lessons the builder chooses from on a short day; it takes what fits. */
const LESSON_LOOKAHEAD = 8;

/**
 * Enough upcoming lessons to fill the day: a lesson for every few of its minutes, so a two-hour
 * day gets its whole study cycle (each subject's block) and not only its first eight lessons.
 */
export function getLessonLookahead(dayMinutes: number): number {
  return Math.max(LESSON_LOOKAHEAD, Math.ceil(dayMinutes / DEFAULT_LESSON_MINUTES));
}

type DayItem = Pick<PlanItem, "chapterId" | "lessonId" | "scheduledFor" | "skillId"> &
  Partial<Pick<PlanItem, "facts" | "lessons">>;

/** The plan items a day's lessons come from. */
export const LEARN_KINDS: ReadonlySet<PlanItem["kind"]> = new Set(["lesson", "chapter"]);

/** A stand-in: lessons of a skill the Library hasn't outlined yet, with nothing to open now. */
function isStandIn(item: DayItem): boolean {
  return item.lessonId === null && item.chapterId === null && item.skillId !== null;
}

function isDue({ item, today }: { item: DayItem; today: Date }): boolean {
  return item.scheduledFor !== null && item.scheduledFor <= today;
}

/** The selected producer's actual consumed interval, including a long lesson that ends later. */
function isAllocatedOn({ item, today }: { item: DayItem; today: Date }): boolean {
  if (item.scheduledFor === null || isDue({ item, today })) {
    return true;
  }

  const facts = readSelectedItemFacts(item.facts);
  const date = toIsoDate(today);
  return facts?.days?.some(([day, , raw]) => day === date && raw > 0) === true;
}

/** The day's subjects in the order its plan reaches them, with the lessons it plans for each. */
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
      const lessons = isStandIn(item) ? (item.lessons ?? 1) : 1;
      return shares.set(area, (shares.get(area) ?? 0) + lessons);
    }, new Map<string | null, number>());
}

/**
 * An exam day's subjects with nothing written to study today: every lesson the day plans for them
 * is a stand-in and none of their next lessons is written. The day keeps their time for them, as
 * practice on their skills, instead of handing it to another subject (see `pickDayLessonItems`),
 * unless practice has nothing to ask any of them today (`idleSkillIds`): a listening subject
 * whose recordings aren't voiced yet leaves its time to the others.
 */
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
  const written = new Set(items.filter((item) => !isStandIn(item)).map((item) => areaOf(item)));

  const practiced = new Set(
    graph.skills.filter((skill) => !idleSkillIds.has(skill.skillId)).map((skill) => skill.area),
  );

  return [...getDayShares({ graph, items, today }).keys()].flatMap((area) =>
    area !== null && !written.has(area) && practiced.has(area) ? [area] : [],
  );
}

/**
 * The plan's written lessons a day may open: a stand-in has nothing to open, and a lesson whose
 * skill builds on a stand-in's skill the plan has before it, with none of that skill's lessons
 * before it written, waits for it. Reaching past stand-ins, a language plan opened a lesson a year
 * away before the one it builds on was outlined.
 */
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
    if (isStandIn(item)) {
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

/**
 * The lessons a day draws from, in plan order (see `listOpenLessons`). While lessons due by today are still being outlined (`awaitingOutlines`, see
 * `isDayAwaitingOutlines`), the day takes only the lessons due by today: the stand-ins' time stays
 * theirs, instead of later lessons filling it and the day changing under the learner once they
 * land. Otherwise an exam's day takes the ones due by today, then, for the time they leave (a
 * first day has no reviews yet), the next lessons of the same subjects, so the day keeps to its
 * study cycle's few subjects instead of starting tomorrow's. When one of its subjects has nothing
 * written to study (`listHeldAreas`), the others take only their own share (the next lessons of a
 * subject whose lessons today aren't written yet, up to what the day plans for it), and the held
 * subject's time goes to practice on it: Rafaela's day one was 27 linguistics lessons when IT's
 * weren't written. Other goals follow the plan's order, and a day with nothing due does too.
 */
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
  /** What each skill builds on, by skill id. */
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

  // Each subject's own next lessons, up to what the day plans for it, in plan order.
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

/**
 * The skills of an exam day's held subjects (`listHeldAreas`), which practice asks first so the
 * day's time for them stays theirs. None while the day's lessons are being outlined
 * (`awaitingOutlines`): the day holds that time for the lessons instead.
 */
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

/**
 * A day's lessons from its goal's plan (`pickDayLessonItems`), and the skills of its subjects with
 * nothing written yet, which practice asks first (`listHeldSkillIds`).
 */
export function pickDayLessons<TItem extends DayItem & Pick<PlanItem, "kind" | "status">>({
  awaitingOutlines,
  goal,
  heldDay = false,
  localDate,
  plan,
}: {
  awaitingOutlines: boolean;
  /** A shown selected day takes its actual producer allocation, never a future lookahead refill. */
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
