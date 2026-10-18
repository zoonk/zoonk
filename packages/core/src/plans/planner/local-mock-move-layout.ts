import { type BuildPlanInput } from "./build-plan";
import { type PracticeFunding } from "./committed-mock-funding";
import { type StudyPortion } from "./interval-study-minutes";
import { type TeachingOrder, getBounds, getMoveCap, getTeachingOrder } from "./local-move-bounds";
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
import { type PlannedItem, getItemKey } from "./plan-items";
import { type QueueUnit } from "./plan-units";
import { breaksPrerequisitesFirst } from "./prerequisites-first";
import { type PlanDay } from "./schedule-units";
import { listIntervalTeaching } from "./this-week-items";

type Portions = Map<string, StudyPortion[]>;

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

/** What every interval a move tries shares: its days, its input, the lanes and rule 2's cap. */
type MoveScope = {
  cap: number;
  days: readonly PlanDay[];
  input: BuildPlanInput;
  order: TeachingOrder;
};

function tryInterval({
  interval,
  portions,
  scope,
}: {
  interval: Interval;
  portions: Portions;
  scope: MoveScope;
}): Portions | null {
  const { cap, days, input, order } = scope;

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
  const fitted = new Map<string, string>();

  const fits = input.items
    .filter((item) => released.has(getItemKey(item)))
    .every((item) => {
      const key = getItemKey(item);
      const removed = released.get(key) ?? [];
      const bounds = getBounds({ cap, displaced: released, fitted, input, item, order, portions });

      const parts = placeDisplaced({
        available,
        days,
        from: Math.max(bounds.from, fromIsoDate(interval.from).getTime()),
        minutes: removed.reduce((sum, part) => sum + part.minutes, 0),
        raw: removed.reduce((sum, part) => sum + part.lessonMinutes, 0),
        until: Math.min(bounds.until, fromIsoDate(interval.to).getTime()),
      });

      if (!parts) {
        return false;
      }

      parts.forEach((part) =>
        available.set(part.date, (available.get(part.date) ?? 0) - part.minutes),
      );

      placed.set(
        key,
        [...fixedPortions({ displaced: released, key, portions }), ...parts].toSorted((a, b) =>
          a.date.localeCompare(b.date),
        ),
      );

      fitted.set(key, parts.at(-1)?.date ?? interval.from);
      return true;
    });

  return fits ? new Map([...portions, ...placed]) : null;
}

function smallestInterval({
  accepts,
  interval,
  latest,
  portions,
  scope,
}: {
  /** Whether the plan a layout gives keeps what a skill builds on first. */
  accepts: (portions: Portions) => boolean;
  interval: Interval;
  latest: string;
  portions: Portions;
  scope: MoveScope;
}): { interval: Interval; portions: Portions } | null {
  const starts = scope.days
    .filter((day) => toIsoDate(day.date) >= interval.from && toIsoDate(day.date) <= latest)
    .toReversed();

  for (const day of starts) {
    const candidate = { from: toIsoDate(day.date), to: interval.to };
    const fitted = tryInterval({ interval: candidate, portions, scope });

    if (fitted && accepts(fitted)) {
      return { interval: candidate, portions: fitted };
    }
  }

  return null;
}

/**
 * The learner asked for the move (LEAD rule 1), so the work its day can't hold goes on, in order,
 * to the earliest later days with room: the interval grows one plan day at a time before `cap`.
 */
function growForward(request: Parameters<typeof smallestInterval>[0]) {
  const { interval, scope } = request;

  const later = scope.days.filter(
    (day) => toIsoDate(day.date) > interval.to && day.date.getTime() < scope.cap,
  );

  for (const day of later) {
    const grown = smallestInterval({
      ...request,
      interval: { from: interval.from, to: toIsoDate(day.date) },
    });

    if (grown) {
      return grown;
    }
  }

  return null;
}

/**
 * A move changes the smallest selected interval that fits, grown forward when the move's own days
 * can't hold its work (see `growForward`); no work outside it is recruited or moved.
 */
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

  const order = getTeachingOrder(input);

  const accepts = (fitted: Portions) =>
    !breaksPrerequisitesFirst({
      after: projectStudyItems({ items, portions: fitted, saved }),
      before: items,
      lessons: input.lessons,
      prerequisites: input.prerequisites,
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

      const scope = { cap: getMoveCap({ days, input, to: interval.to }), days, input, order };
      const request = { accepts, interval, latest, portions: state.portions, scope };
      const fitted = smallestInterval(request) ?? growForward(request);

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
