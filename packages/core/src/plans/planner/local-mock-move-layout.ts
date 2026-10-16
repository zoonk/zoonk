import { type BuildPlanInput } from "./build-plan";
import { type PracticeFunding } from "./committed-mock-funding";
import { type StudyPortion } from "./interval-study-minutes";
import { EPSILON } from "./mock-day";
import {
  fixedPortions,
  getDisplacedLessonPortions,
  getLocalMoveIntervals,
  getSelectionShiftFacts,
  getStudyCapacity,
  isTeaching,
  listPinnedStudyPortions,
  projectStudyItems,
  withFundedPractice,
} from "./pinned-study-portions";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { fitCheckpointPractice } from "./plan-events";
import { type ExistingPlanItem, type PlannedItem, getItemKey } from "./plan-items";
import { type QueueUnit } from "./plan-units";
import { type PlanDay } from "./schedule-units";
import { listIntervalTeaching } from "./this-week-items";

type Portions = Map<string, StudyPortion[]>;

function endOf({
  input,
  item,
  placed,
  portions,
}: {
  input: BuildPlanInput;
  item: ExistingPlanItem;
  placed: ReadonlyMap<string, readonly StudyPortion[]>;
  portions: ReadonlyMap<string, readonly StudyPortion[]>;
}): number {
  if (item.status !== "todo") {
    return (input.finishedOn?.get(item.id) ?? input.today).getTime();
  }

  const own = placed.get(getItemKey(item)) ?? portions.get(getItemKey(item));
  const last = own?.at(-1);
  return last ? fromIsoDate(last.date).getTime() : (item.scheduledFor?.getTime() ?? 0);
}

function getBounds({
  displaced,
  input,
  item,
  placed,
  portions,
}: {
  displaced: ReadonlyMap<string, readonly StudyPortion[]>;
  input: BuildPlanInput;
  item: ExistingPlanItem;
  placed: ReadonlyMap<string, readonly StudyPortion[]>;
  portions: ReadonlyMap<string, readonly StudyPortion[]>;
}) {
  const teaching = input.items.filter((entry) => isTeaching(entry));
  const index = teaching.indexOf(item);

  const previous = teaching
    .slice(0, index)
    .findLast((other) => !displaced.has(getItemKey(other)) || placed.has(getItemKey(other)));

  const next = teaching
    .slice(index + 1)
    .find((other) => other.status === "todo" && !displaced.has(getItemKey(other)));

  const boss = input.items.find(
    (other) => other.kind === "boss" && other.phase === item.phase && other.status === "todo",
  );

  const removed = displaced.get(getItemKey(item)) ?? [];
  const own = fixedPortions({ displaced, key: getItemKey(item), portions });
  const ownBefore = own.findLast((part) => part.date < (removed[0]?.date ?? ""));
  const ownAfter = own.find((part) => part.date > (removed.at(-1)?.date ?? ""));

  return {
    from: Math.max(
      input.today.getTime(),
      ownBefore ? fromIsoDate(ownBefore.date).getTime() : 0,
      previous ? endOf({ input, item: previous, placed, portions }) : 0,
    ),
    until: Math.min(
      ownAfter ? fromIsoDate(ownAfter.date).getTime() : Infinity,
      next?.scheduledFor?.getTime() ?? Infinity,
      boss?.scheduledFor?.getTime() ?? Infinity,
    ),
  };
}

function placeDisplaced({
  available,
  days,
  from,
  raw,
  minutes,
  until,
}: {
  available: ReadonlyMap<string, number>;
  days: readonly PlanDay[];
  from: number;
  minutes: number;
  raw: number;
  until: number;
}): StudyPortion[] | null {
  const eligible = days.filter((day) => day.date.getTime() >= from && day.date.getTime() <= until);

  const fitted = eligible.reduce<{ left: number; portions: StudyPortion[]; rawLeft: number }>(
    (state, day) => {
      const date = toIsoDate(day.date);
      const study = Math.min(state.left, Math.max(0, available.get(date) ?? 0));

      const lessonMinutes =
        study >= state.left - EPSILON
          ? state.rawLeft
          : Math.min(state.rawLeft, (study * raw) / minutes);

      return study > EPSILON
        ? {
            left: state.left - study,
            portions: [...state.portions, { date, lessonMinutes, minutes: study }],
            rawLeft: state.rawLeft - lessonMinutes,
          }
        : state;
    },
    { left: minutes, portions: [], rawLeft: raw },
  );

  return fitted.left <= EPSILON ? fitted.portions : null;
}

/** The selected work that actually shifts inside a minimal local interval. */
export type SelectionShift = {
  from: string;
  itemKeys: string[];
  lessons: number | null;
  to: string;
};
type Interval = { from: string; to: string };

function tryInterval({
  days,
  input,
  interval,
  portions,
}: {
  days: readonly PlanDay[];
  input: BuildPlanInput;
  interval: Interval;
  portions: Portions;
}): Portions | null {
  const released = listIntervalTeaching({
    interval,
    items: input.items.filter((item) => isTeaching(item)),
    portions,
  });

  const available = new Map(days.map((day) => [toIsoDate(day.date), getStudyCapacity(day)]));

  // Fixed review events already take their time in getStudyCapacity.
  for (const item of input.items.filter((entry) => isTeaching(entry))) {
    fixedPortions({ displaced: released, key: getItemKey(item), portions }).forEach((part) =>
      available.set(part.date, (available.get(part.date) ?? 0) - part.minutes),
    );
  }

  const placed: Portions = new Map();

  const fits = input.items
    .filter((item) => released.has(getItemKey(item)))
    .every((item) => {
      const key = getItemKey(item);
      const removed = released.get(key) ?? [];
      const bounds = getBounds({ displaced: released, input, item, placed, portions });

      const fitted = placeDisplaced({
        available,
        days,
        from: Math.max(bounds.from, fromIsoDate(interval.from).getTime()),
        minutes: removed.reduce((sum, part) => sum + part.minutes, 0),
        raw: removed.reduce((sum, part) => sum + part.lessonMinutes, 0),
        until: Math.min(bounds.until, fromIsoDate(interval.to).getTime()),
      });

      if (!fitted) {
        return false;
      }

      fitted.forEach((part) =>
        available.set(part.date, (available.get(part.date) ?? 0) - part.minutes),
      );

      placed.set(
        key,
        [...fixedPortions({ displaced: released, key, portions }), ...fitted].toSorted((a, b) =>
          a.date.localeCompare(b.date),
        ),
      );

      return true;
    });

  return fits ? new Map([...portions, ...placed]) : null;
}

function smallestInterval({
  days,
  input,
  interval,
  latest,
  portions,
}: {
  days: readonly PlanDay[];
  input: BuildPlanInput;
  interval: Interval;
  latest: string;
  portions: Portions;
}): { interval: Interval; portions: Portions } | null {
  const starts = days
    .filter((day) => toIsoDate(day.date) >= interval.from && toIsoDate(day.date) <= latest)
    .toReversed();

  for (const day of starts) {
    const candidate = { from: toIsoDate(day.date), to: interval.to };
    const fitted = tryInterval({ days, input, interval: candidate, portions });

    if (fitted) {
      return { interval: candidate, portions: fitted };
    }
  }

  return null;
}

/** A move changes the smallest fitting selected interval; no work outside it is recruited or moved. */
export function layOutLocalMockMove({
  days: givenDays,
  input,
  items,
  practiceFunding = [],
  units,
}: {
  days: readonly PlanDay[];
  input: BuildPlanInput;
  items: PlannedItem[];
  practiceFunding?: readonly PracticeFunding[];
  units: ReadonlyMap<string, QueueUnit>;
}) {
  const saved = listPinnedStudyPortions({ input, units });

  const { days, portions } = fitCheckpointPractice({ days: givenDays, input, portions: saved });

  const displaced = getDisplacedLessonPortions({ days, input, portions });

  const funded = withFundedPractice({
    contributions: practiceFunding.flatMap((entry) => entry.contributions),
    displaced,
    portions,
  });

  const result = getLocalMoveIntervals(input).reduce<{
    portions: Portions;
    shifts: SelectionShift[];
    valid: boolean;
  }>(
    (state, interval) => {
      if (!state.valid) {
        return state;
      }

      const [latest] = [...displaced.values()]
        .flat()
        .filter((part) => part.date >= interval.from && part.date <= interval.to)
        .map((part) => part.date)
        .toSorted((a, b) => a.localeCompare(b));

      if (!latest) {
        return state;
      }

      const fitted = smallestInterval({ days, input, interval, latest, portions: state.portions });

      if (!fitted) {
        return { portions: state.portions, shifts: state.shifts, valid: false };
      }

      const shift = getSelectionShiftFacts({
        after: fitted.portions,
        before: state.portions,
        items: input.items,
      });

      return {
        portions: fitted.portions,
        shifts:
          shift.itemKeys.length > 0
            ? [...state.shifts, { ...fitted.interval, ...shift }]
            : state.shifts,
        valid: true,
      };
    },
    { portions: funded, shifts: [], valid: true },
  );

  if (!result.valid) {
    return {
      items: items.filter(
        (item) =>
          !(
            (item.kind === "mock" || item.kind === "checkpoint") &&
            item.scheduledFor &&
            input.requestedMoveDates?.has(toIsoDate(item.scheduledFor))
          ),
      ),
      planDays: days,
      portions: funded,
      selectionShifts: [],
    };
  }

  return {
    items: projectStudyItems({ items, portions: result.portions, saved }),
    planDays: days,
    portions: result.portions,
    selectionShifts: result.shifts,
  };
}

/** Ordinary runs keep their layout; only an explicitly local edit pins and displaces selection. */
export function layOutSelectedMove(
  request: Parameters<typeof layOutLocalMockMove>[0] & { portions: Portions },
) {
  return request.input.keepSelection
    ? layOutLocalMockMove(request)
    : {
        items: request.items,
        planDays: undefined,
        portions: request.portions,
        selectionShifts: [],
      };
}
