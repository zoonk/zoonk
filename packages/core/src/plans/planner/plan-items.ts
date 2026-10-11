import { type PlanItemKind, type PlanItemStatus } from "@zoonk/db";
import { toIsoDate } from "./plan-calendar";
import { getBossKey, getLessonKey, getSkillKey } from "./plan-units";
import { type ScheduledEvent, type ScheduledUnit } from "./schedule-units";

/** A plan item as stored, before this planning run. */
export type ExistingPlanItem = {
  chapterId: string | null;
  completedAt: Date | null;
  id: string;
  kind: PlanItemKind;
  lessonId: string | null;
  /**
   * A stand-in's lessons: how many of its skill's lessons the plan teaches in its place, after
   * cuts and base choices, as the plan saved it. Null or absent for every other item.
   */
  lessons?: number | null;
  phase: number;
  position: number;
  scheduledFor: Date | null;
  skillId: string | null;
  status: PlanItemStatus;
  titleSnapshot: string;
};

/** A plan item after this run: `id` is kept for items that were already in the plan. */
export type PlannedItem = Omit<ExistingPlanItem, "id" | "position"> & {
  id: string | null;
  key: string;
  /** Study time it takes, reviews and practice around a lesson included. */
  minutes: number;
};

/** Identifies an item across planning runs, so ids and finished work carry over. */
export function getItemKey(
  item: Pick<
    ExistingPlanItem,
    "chapterId" | "id" | "kind" | "lessonId" | "phase" | "scheduledFor" | "skillId"
  >,
): string {
  if (item.lessonId) {
    return getLessonKey(item.lessonId);
  }

  if (item.kind === "lesson" && item.skillId) {
    return getSkillKey(item.skillId);
  }

  if (item.kind === "boss") {
    return getBossKey(item.phase);
  }

  if (item.scheduledFor && item.kind !== "chapter") {
    return `${item.kind}:${toIsoDate(item.scheduledFor)}`;
  }

  return item.kind === "chapter" && item.chapterId
    ? `chapter:${item.chapterId}`
    : `item:${item.id}`;
}

/** On one date: work already kept first, then lessons in queue order, then fixed events. */
type RankedItem = { item: PlannedItem; rank: number };

const KEPT_RANK = 0;
const UNIT_RANK = 1;
const EVENT_RANK = 2;

function getSortDate(item: PlannedItem): number {
  return (item.scheduledFor ?? item.completedAt)?.getTime() ?? 0;
}

/** Sorting is stable, so items of the same date and rank keep the order they came in. */
function compareItems(a: RankedItem, b: RankedItem): number {
  return getSortDate(a.item) - getSortDate(b.item) || a.rank - b.rank;
}

/** A scheduled unit as a new plan item. */
export function fromUnit(unit: ScheduledUnit): PlannedItem {
  return {
    chapterId: unit.chapterId,
    completedAt: null,
    id: null,
    key: unit.key,
    kind: unit.kind,
    lessonId: unit.lessonId,
    minutes: unit.studyMinutes,
    phase: unit.phase,
    scheduledFor: unit.date,
    skillId: unit.skillId,
    status: "todo",
    titleSnapshot: unit.title,
  };
}

function fromEvent(event: ScheduledEvent): PlannedItem {
  return {
    chapterId: null,
    completedAt: null,
    id: null,
    key: event.key,
    kind: event.kind,
    lessonId: null,
    minutes: event.minutes,
    phase: event.phase ?? -1,
    scheduledFor: event.date,
    skillId: null,
    status: "todo",
    titleSnapshot: event.title,
  };
}

/**
 * Events of learn plans belong to the phase of the lessons before them, never one after the phase
 * the work still to do after them studies: a lesson of a later phase done ahead dated that phase's
 * weekly challenge, which then read as running before the phases still to study (R39, language
 * seed 1049).
 */
function fillEventPhases(items: readonly PlannedItem[]): PlannedItem[] {
  const firstPhase = items.find((item) => item.phase >= 0)?.phase ?? 0;

  // The phase of the first item still to do from each index on, events aside.
  const nextTodo = items.reduceRight<(number | undefined)[]>((next, item, index) => {
    next[index] = item.phase >= 0 && item.status === "todo" ? item.phase : next[index + 1];
    return next;
  }, []);

  return items.reduce<PlannedItem[]>((filled, item, index) => {
    const previous = filled.at(-1)?.phase ?? firstPhase;
    const studied = nextTodo[index + 1] ?? previous;

    filled.push(item.phase >= 0 ? item : { ...item, phase: Math.min(previous, studied) });
    return filled;
  }, []);
}

/**
 * Puts finished work, items kept from this week, and newly scheduled lessons and events in one
 * order: by date, then finished first, lessons in queue order, fixed events last. New items reuse
 * the id of the todo item they replace, so an item keeps its identity while its date moves, and
 * the chapter it teaches from: a skill's item linked to a chapter (whose next lesson the session
 * picks) stays that chapter's instead of turning into a stand-in waiting for lessons.
 */
export function mergePlanItems({
  events,
  kept,
  replaced,
  units,
}: {
  events: readonly ScheduledEvent[];
  /** Finished items and this week's items an automatic run keeps, with their minutes. */
  kept: readonly PlannedItem[];
  /** Todo items this run replaces, whose ids new items reuse. */
  replaced: readonly ExistingPlanItem[];
  units: readonly ScheduledUnit[];
}): PlannedItem[] {
  const keptKeys = new Set(kept.map((item) => item.key));
  const replacedItems = new Map(replaced.map((item) => [getItemKey(item), item]));

  const withId = (item: PlannedItem): PlannedItem => {
    const previous = replacedItems.get(item.key);

    return {
      ...item,
      chapterId: item.chapterId ?? previous?.chapterId ?? null,
      id: previous?.id ?? null,
    };
  };

  const isFresh = (item: PlannedItem) => !keptKeys.has(item.key);

  const ranked: RankedItem[] = [
    ...kept.map((item) => ({ item, rank: KEPT_RANK })),
    ...units.map((unit) => ({ item: withId(fromUnit(unit)), rank: UNIT_RANK })),
    ...events.map((event) => ({ item: withId(fromEvent(event)), rank: EVENT_RANK })),
  ].filter(({ item, rank }) => rank === KEPT_RANK || isFresh(item));

  return fillEventPhases(ranked.toSorted(compareItems).map(({ item }) => item));
}
