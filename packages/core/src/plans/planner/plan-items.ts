import { type PlanItem, type PlanItemKind, type PlanItemStatus } from "@zoonk/db";
import { toIsoDate } from "./plan-calendar";
import { getBossKey, getLessonKey, getSkillKey } from "./plan-units";
import { type ScheduledEvent, type ScheduledUnit } from "./schedule-units";

export type ExistingPlanItem = {
  chapterId: string | null;
  completedAt: Date | null;
  id: string;
  facts?: PlanItem["facts"];
  kind: PlanItemKind;
  lessonId: string | null;
  lessons?: number | null;
  phase: number;
  position: number;
  scheduledFor: Date | null;
  skillId: string | null;
  status: PlanItemStatus;
  titleSnapshot: string;
};

export type PlannedItem = Omit<ExistingPlanItem, "id" | "position"> & {
  id: string | null;
  key: string;
  minutes: number;
};

export function getItemKey(
  item: Pick<
    ExistingPlanItem,
    "chapterId" | "kind" | "lessonId" | "phase" | "scheduledFor" | "skillId"
  > & { id: string | null },
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

export type RankedItem = { item: PlannedItem; rank: number };

export const KEPT_RANK = 0;
export const LEADING_RANK = 1;
export const UNIT_RANK = 2;
export const EVENT_RANK = 3;

export function getSortDate(item: PlannedItem): number {
  return (item.scheduledFor ?? item.completedAt)?.getTime() ?? 0;
}

/** Sorting is stable, so items of the same date and rank keep the order they came in. */
export function compareItems(a: RankedItem, b: RankedItem): number {
  return getSortDate(a.item) - getSortDate(b.item) || a.rank - b.rank;
}

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

function fillEventPhases(items: readonly PlannedItem[]): PlannedItem[] {
  const firstPhase = items.find((item) => item.phase >= 0)?.phase ?? 0;

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

export function mergePlanItems({
  events,
  kept,
  replaced,
  units,
}: {
  events: readonly ScheduledEvent[];
  kept: readonly PlannedItem[];
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
    ...events.map((event) => ({
      item: withId(fromEvent(event)),
      rank: event.leads ? LEADING_RANK : EVENT_RANK,
    })),
  ].filter(({ item, rank }) => rank === KEPT_RANK || isFresh(item));

  return fillEventPhases(ranked.toSorted(compareItems).map(({ item }) => item));
}
