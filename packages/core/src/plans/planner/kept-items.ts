import { type BuildPlanInput } from "./build-plan";
import { getKeptMinutes } from "./kept-minutes";
import { LEARN_KINDS, isStandIn } from "./plan-item-rules";
import { type ExistingPlanItem, type PlannedItem, getItemKey } from "./plan-items";
import { type ExamWindow } from "./plan-phases";
import { type QueueUnit } from "./plan-units";
import {
  type DroppedUnit,
  type PlanDay,
  type ScheduledEvent,
  type ScheduledUnit,
} from "./schedule-units";
import { listThisWeekItems } from "./this-week-items";

function isLandedStandIn({
  item,
  planned,
  written,
}: {
  item: ExistingPlanItem;
  planned: ReadonlySet<string>;
  written: (skillId: string) => readonly string[];
}) {
  const lessons = written(item.skillId ?? "");

  return (
    isStandIn(item) &&
    lessons.some((lessonId) => !planned.has(lessonId)) &&
    !lessons.some((lessonId) => planned.has(lessonId))
  );
}

function listWrittenLessons(input: BuildPlanInput) {
  return (skillId: string) =>
    input.lessons.flatMap((lesson) => (lesson.skillIds.includes(skillId) ? [lesson.lessonId] : []));
}

export function splitExistingItems({
  input,
  keepsRest = false,
  landedSkillIds,
  queue,
}: {
  input: BuildPlanInput;
  keepsRest?: boolean;
  landedSkillIds?: Pick<ReadonlySet<string>, "has">;
  queue: readonly QueueUnit[];
}) {
  const setAsideBefore = input.bringBackSetAside
    ? input.items.filter((item) => item.status === "skipped")
    : [];

  const finished = input.items.filter(
    (item) => item.status !== "todo" && !setAsideBefore.includes(item),
  );

  const planned = new Set(input.items.flatMap((item) => item.lessonId ?? []));

  const bySkill = Map.groupBy(
    queue.filter((unit) => unit.lessonId !== null),
    (unit) => unit.skillId ?? "",
  );

  const written = (skillId: string) =>
    (bySkill.get(skillId) ?? []).flatMap((unit) => (unit.lessonId ? [unit.lessonId] : []));

  const thisWeek = listThisWeekItems({ input, keepsRest });

  const landed = thisWeek.filter(
    (item) =>
      (!keepsRest && isLandedStandIn({ item, planned, written })) ||
      (isStandIn(item) && landedSkillIds?.has(item.skillId ?? "") === true),
  );

  const frozen = thisWeek.filter((item) => !landed.includes(item));
  const keptIds = new Set([...finished, ...frozen].map((item) => item.id));
  const replaced = input.items.filter((item) => !keptIds.has(item.id));

  return { finished, frozen, landed, replaced, setAsideBefore, thisWeek };
}

export function toKeptItem({
  item,
  input,
  units,
  windows,
}: {
  item: ExistingPlanItem;
  input: BuildPlanInput;
  units: ReadonlyMap<string, QueueUnit>;
  windows: readonly ExamWindow[];
}): PlannedItem {
  const isFuture = item.scheduledFor !== null && item.scheduledFor > input.today;
  const moveToToday = input.mode === "forced" && item.status !== "todo" && isFuture;

  return {
    ...item,
    key: getItemKey(item),
    minutes: getKeptMinutes({ input, item, units, windows }),
    scheduledFor: moveToToday ? input.today : item.scheduledFor,
  };
}

export function countKeptLessons({
  gaps = new Set(),
  kept,
  lessons,
  units,
}: {
  gaps?: ReadonlySet<string>;
  kept: readonly ExistingPlanItem[];
  lessons: readonly QueueUnit[];
  units: ReadonlyMap<string, QueueUnit>;
}): Map<string, number> {
  const counted = [
    ...kept.flatMap((item) =>
      item.kind === "lesson" &&
      item.skillId &&
      item.status !== "skipped" &&
      !(item.status === "testedOut" && gaps.has(item.skillId))
        ? [
            {
              lessons: item.lessonId ? 1 : (units.get(getItemKey(item))?.lessons ?? 1),
              skillId: item.skillId,
            },
          ]
        : [],
    ),
    ...lessons.flatMap((unit) => (unit.skillId ? [{ lessons: 1, skillId: unit.skillId }] : [])),
  ];

  return counted.reduce(
    (counts, entry) => counts.set(entry.skillId, (counts.get(entry.skillId) ?? 0) + entry.lessons),
    new Map<string, number>(),
  );
}

export type KeptPiece = { date: Date; key: string; saved: boolean; share: number };

function getKeptShare({
  item,
  units,
}: {
  item: ExistingPlanItem;
  units: ReadonlyMap<string, QueueUnit>;
}): number {
  const total = units.get(getItemKey(item))?.lessons;
  return item.lessonId === null && item.lessons && total ? Math.min(1, item.lessons / total) : 1;
}

export function listThisWeekWork({
  frozen,
  landed,
  units,
}: {
  frozen: readonly ExistingPlanItem[];
  landed: readonly { date: Date; key: string }[];
  units: ReadonlyMap<string, QueueUnit>;
}): KeptPiece[] {
  return [
    ...frozen.flatMap((item) =>
      item.scheduledFor
        ? [
            {
              date: item.scheduledFor,
              key: getItemKey(item),
              saved: true,
              share: getKeptShare({ item, units }),
            },
          ]
        : [],
    ),
    ...landed.map((unit) => ({ date: unit.date, key: unit.key, saved: false, share: 1 })),
  ];
}

export function listKeptStandInCuts({
  frozen,
  units,
}: {
  frozen: readonly ExistingPlanItem[];
  units: ReadonlyMap<string, QueueUnit>;
}): DroppedUnit[] {
  return frozen.flatMap((item) => {
    const unit = units.get(getItemKey(item));
    const share = getKeptShare({ item, units });

    return unit && share < 1 ? [{ ...unit, fittedMinutes: unit.minutes * share }] : [];
  });
}

function listThisWeekKeys({
  frozen,
  landed,
}: {
  frozen: readonly ExistingPlanItem[];
  landed: readonly { key: string }[];
}): Set<string> {
  return new Set([...frozen.map((item) => getItemKey(item)), ...landed.map((unit) => unit.key)]);
}

export function keepThisWeek({
  days,
  frozen,
  landed,
  schedule,
  start,
}: {
  days: readonly PlanDay[];
  frozen: readonly ExistingPlanItem[];
  landed: readonly ScheduledUnit[];
  schedule: { dropped: DroppedUnit[]; events: ScheduledEvent[]; units: ScheduledUnit[] };
  start: Date;
}) {
  const hidden = listThisWeekKeys({ frozen, landed });

  const first = days.find((day) => day.date >= start);
  const isNew = (unit: QueueUnit) => !hidden.has(unit.key);
  const fresh = schedule.units.filter((unit) => isNew(unit));

  const toWeekAfter = (unit: ScheduledUnit): ScheduledUnit[] => {
    if (unit.date >= start) {
      return [unit];
    }

    return first
      ? [
          {
            ...unit,
            date: first.date,
            phase: first.shape.phase ?? unit.phase,
            studyMinutes: unit.minutes / (first.shape.share || 1),
          },
        ]
      : [];
  };

  const outOfTime = first ? [] : fresh.filter((unit) => unit.date < start);

  return {
    ...schedule,
    dropped: [
      ...schedule.dropped.filter((unit) => isNew(unit)),
      ...outOfTime.map(({ date: _date, studyMinutes: _study, ...unit }) => ({
        ...unit,
        fittedMinutes: 0,
      })),
    ],
    units: [...landed, ...fresh.flatMap((unit) => toWeekAfter(unit))],
  };
}

export function setAsideLeftWork({
  input,
  placed,
  yielded = new Set(),
}: {
  input: BuildPlanInput;
  placed: readonly { key: string; skillId: string | null }[];
  yielded?: ReadonlySet<string>;
}): PlannedItem[] {
  if (!input.setAsideLeftWork && yielded.size === 0) {
    return [];
  }

  const placedKeys = new Set(placed.map((entry) => entry.key));
  const placedSkills = new Set(placed.flatMap((entry) => entry.skillId ?? []));
  const planned = new Set(input.items.flatMap((item) => item.lessonId ?? []));

  return input.items.flatMap((item) => {
    const key = getItemKey(item);

    const isOverdue =
      input.setAsideLeftWork === true &&
      item.scheduledFor !== null &&
      item.scheduledFor < input.today;

    const left =
      item.status === "todo" &&
      LEARN_KINDS.has(item.kind) &&
      (isOverdue || yielded.has(key)) &&
      !placedKeys.has(key) &&
      !(
        placedSkills.has(item.skillId ?? "") &&
        isLandedStandIn({ item, planned, written: listWrittenLessons(input) })
      );

    return left ? [{ ...item, key, minutes: 0, status: "skipped" as const }] : [];
  });
}
