import { readSelectedItemFacts } from "../_utils/selected-item-contract";
import { type PlanOperation } from "../plan-contract";
import { type BuildPlanInput } from "./build-plan";
import { type PracticeFunding, getRequestedMoves } from "./committed-mock-funding";
import { type StudyPortion } from "./interval-study-minutes";
import { toKeptItem } from "./kept-items";
import { getKeptMinutes } from "./kept-minutes";
import { EPSILON } from "./mock-day";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { type ExistingPlanItem, type PlannedItem, getItemKey } from "./plan-items";
import { type QueueUnit } from "./plan-units";
import { type PlanDay, getLessonCapacity } from "./schedule-units";

type Portions = Map<string, StudyPortion[]>;

/** Whether the operation batch is a local move, decided before any build. */
export function isMoveOnlyPlanChange(operations: readonly PlanOperation[]): boolean {
  return (
    operations.length > 0 && operations.every((operation) => operation.kind === "moveWeeklyEvent")
  );
}

export function getSelectionOptions({
  bringBackSetAside = false,
  keepSelection = false,
}: Pick<BuildPlanInput, "bringBackSetAside" | "keepSelection">) {
  return { bringBackSetAside, keepSelection };
}

export function keepSelectedItem(request: Parameters<typeof toKeptItem>[0]): PlannedItem {
  const item = toKeptItem(request);
  const facts = request.input.keepSelection && readSelectedItemFacts(request.item.facts);
  return facts ? { ...item, minutes: facts.minutes } : item;
}

export function isTeaching(item: ExistingPlanItem | PlannedItem): boolean {
  return item.kind === "lesson" || item.kind === "chapter";
}

/** A local edit reserves saved teaching and review practice, including every long-lesson day. */
export function listPinnedStudyPortions({
  input,
  units,
}: {
  input: BuildPlanInput;
  units: ReadonlyMap<string, QueueUnit>;
}): Portions {
  return new Map(
    input.items.flatMap((item) => {
      if (
        (!isTeaching(item) && item.kind !== "review") ||
        item.status !== "todo" ||
        !item.scheduledFor
      ) {
        return [];
      }

      const key = getItemKey(item);
      const facts = readSelectedItemFacts(item.facts);

      const minutes =
        facts?.minutes ?? getKeptMinutes({ input, item, units, windows: input.examWindows ?? [] });

      const raw = facts
        ? facts.parts.written + facts.parts.unwritten
        : Math.min(minutes, units.get(key)?.minutes ?? minutes);

      const portions = facts?.days?.map(([date, study, lessonMinutes]) => ({
        date,
        lessonMinutes,
        minutes: study,
      })) ?? [
        {
          date: toIsoDate(item.scheduledFor),
          lessonMinutes: item.kind === "review" ? 0 : raw,
          minutes,
        },
      ];

      return [[key, portions]];
    }),
  );
}

export function withFundedPractice({
  contributions,
  displaced,
  portions,
}: {
  contributions: readonly PracticeFunding["contributions"][number][];
  displaced: ReadonlyMap<string, readonly StudyPortion[]>;
  portions: Portions;
}): Portions {
  const left = new Map<string, number>();

  contributions.forEach((part) => left.set(part.date, (left.get(part.date) ?? 0) + part.minutes));

  return new Map(
    [...portions].map(([key, parts]) => {
      const moved = new Set((displaced.get(key) ?? []).map((part) => part.date));

      return [
        key,
        parts.map((part) => {
          const given = moved.has(part.date)
            ? 0
            : Math.min(left.get(part.date) ?? 0, Math.max(0, part.minutes - part.lessonMinutes));

          left.set(part.date, (left.get(part.date) ?? 0) - given);
          return given > EPSILON ? { ...part, minutes: part.minutes - given } : part;
        }),
      ];
    }),
  );
}

/** Pinned allocations carry their own practice; a phase's default share cannot resize them. */
export function getStudyCapacity(day: PlanDay): number {
  return getLessonCapacity(day) / (day.shape.share || 1);
}

/** Only work the requested destination cannot hold gives way; all other selected work stays. */
export function getDisplacedLessonPortions({
  days,
  input,
  portions,
}: {
  days: readonly PlanDay[];
  input: BuildPlanInput;
  portions: ReadonlyMap<string, readonly StudyPortion[]>;
}): Portions {
  const displaced: Portions = new Map();

  days
    .filter((day) => input.requestedMoveDates?.has(toIsoDate(day.date)))
    .forEach((day) => {
      if (!day.shape.events.some((event) => event.kind === "mock" || event.kind === "checkpoint")) {
        return;
      }

      const date = toIsoDate(day.date);

      const onDay = input.items
        .filter((item) => isTeaching(item))
        .flatMap((item) => {
          const key = getItemKey(item);

          const minutes = (portions.get(key) ?? [])
            .filter((part) => part.date === date)
            .reduce((sum, part) => sum + part.minutes, 0);

          return minutes > EPSILON ? [{ key, minutes }] : [];
        });

      const taken = onDay.reduce((sum, item) => sum + item.minutes, 0);
      const capacity = getStudyCapacity(day);

      onDay.toReversed().reduce((left, item) => {
        if (left > capacity + EPSILON) {
          displaced.set(item.key, [
            ...(displaced.get(item.key) ?? []),
            ...(portions.get(item.key) ?? []).filter((part) => part.date === date),
          ]);

          return left - item.minutes;
        }

        return left;
      }, taken);
    });

  return displaced;
}

/** Parts outside the destination remain pinned even when another part of that lesson moves. */
export function fixedPortions({
  key,
  displaced,
  portions,
}: {
  key: string;
  displaced: ReadonlyMap<string, readonly StudyPortion[]>;
  portions: ReadonlyMap<string, readonly StudyPortion[]>;
}): StudyPortion[] {
  const removed = new Set((displaced.get(key) ?? []).map((part) => part.date));
  return (portions.get(key) ?? []).filter((part) => !removed.has(part.date));
}

function dayTotals(parts: readonly StudyPortion[]) {
  return parts.reduce((totals, part) => {
    const old = totals.get(part.date);

    return totals.set(part.date, {
      minutes: (old?.minutes ?? 0) + part.minutes,
      raw: (old?.raw ?? 0) + part.lessonMinutes,
    });
  }, new Map<string, { minutes: number; raw: number }>());
}

function isSamePortions(first: readonly StudyPortion[], second: readonly StudyPortion[]): boolean {
  const before = dayTotals(first);
  const after = dayTotals(second);

  return (
    before.size === after.size &&
    [...before].every(([date, amount]) => {
      const next = after.get(date);

      return (
        next &&
        Math.abs(next.minutes - amount.minutes) <= EPSILON &&
        Math.abs(next.raw - amount.raw) <= EPSILON
      );
    })
  );
}

function hasTeachingShift({
  after,
  before,
  item,
}: {
  after: readonly StudyPortion[];
  before: readonly StudyPortion[];
  item: ExistingPlanItem;
}): boolean {
  if (isSamePortions(before, after)) {
    return false;
  }

  if (item.kind === "chapter" || !item.lessonId) {
    return true;
  }

  const previous = dayTotals(before);
  const next = dayTotals(after);

  // A whole authored row still identifies a lesson when a legacy fallback knows no raw minutes.
  if (before.length === 1 && before.every((part) => part.lessonMinutes <= EPSILON)) {
    return previous.size !== next.size || [...previous.keys()].some((date) => !next.has(date));
  }

  return [...new Set([...previous.keys(), ...next.keys()])].some(
    (date) => Math.abs((previous.get(date)?.raw ?? 0) - (next.get(date)?.raw ?? 0)) > EPSILON,
  );
}

/** Count actual shifted written identities once; aggregate work has no exact lesson count. */
export function getSelectionShiftFacts({
  after,
  before,
  items,
}: {
  after: ReadonlyMap<string, readonly StudyPortion[]>;
  before: ReadonlyMap<string, readonly StudyPortion[]>;
  items: readonly ExistingPlanItem[];
}): { itemKeys: string[]; lessons: number | null } {
  const shifted = items
    .filter((item) => isTeaching(item))
    .filter((item) => {
      const key = getItemKey(item);
      const previous = before.get(key);
      const next = after.get(key);
      return previous && next && hasTeachingShift({ after: next, before: previous, item });
    });

  const actual = shifted.every((item) => item.kind === "lesson" && item.lessonId);

  return {
    itemKeys: [...new Set(shifted.map((item) => getItemKey(item)))],
    lessons: actual ? new Set(shifted.map((item) => item.lessonId)).size : null,
  };
}

/** Unchanged rows stay exact; changed portions keep the saved due-date convention. */
export function projectStudyItems({
  items,
  portions,
  saved,
}: {
  items: readonly PlannedItem[];
  portions: Portions;
  saved: Portions;
}): PlannedItem[] {
  return items
    .map((item) => {
      const before = saved.get(item.key);
      const fitted = portions.get(item.key);
      const last = fitted?.at(-1);

      if (!before || !fitted || !last || isSamePortions(before, fitted)) {
        return item;
      }

      const oldEnd = before.at(-1);
      const early = item.scheduledFor && oldEnd && toIsoDate(item.scheduledFor) < oldEnd.date;
      const minutes = fitted.reduce((sum, part) => sum + part.minutes, 0);

      return {
        ...item,
        minutes: Math.abs(minutes - item.minutes) <= EPSILON ? item.minutes : minutes,
        scheduledFor: early ? item.scheduledFor : fromIsoDate(last.date),
      };
    })
    .filter(
      (item) =>
        item.kind !== "review" ||
        item.minutes > EPSILON ||
        isSamePortions(saved.get(item.key) ?? [], portions.get(item.key) ?? []),
    )
    .toSorted((a, b) => (a.scheduledFor?.getTime() ?? 0) - (b.scheduledFor?.getTime() ?? 0));
}

/** Only overlapping requested move intervals can reflow the same selected work. */
export function getLocalMoveIntervals(input: BuildPlanInput): { from: string; to: string }[] {
  const moves = getRequestedMoves({
    moves: input.settings.movedEvents,
    requested: input.requestedMoveDates ?? new Set(),
  })
    .filter((move) => move.from < move.to)
    .toSorted((a, b) => a.from.localeCompare(b.from));

  const intervals: { from: string; to: string }[] = [];

  for (const move of moves) {
    const last = intervals.at(-1);

    if (last && move.from <= last.to) {
      intervals[intervals.length - 1] = {
        from: last.from,
        to: move.to > last.to ? move.to : last.to,
      };
    } else {
      intervals.push(move);
    }
  }

  return intervals;
}
