import { type UnfundedMove } from "../plan-error-contract";
import { type LessonDays, keepWindowTeaching } from "./kept-teaching";
import { findDayMock, fundDay, getMockDayMinutes, getSpendable, sumSavedOn } from "./mock-day";
import {
  type MockClock,
  type MockIdentity,
  type MockResolution,
  getClockMinutes,
  getMockCursor,
  getNextMockDay,
  matchSavedMocks,
} from "./mock-identity";
import { toIsoDate } from "./plan-calendar";
import { PLAN_EPSILON } from "./plan-precision";
import { type MovedEvent, type PlanSettings } from "./plan-state";
import { type DayShape, type PlanDay } from "./schedule-units";

export type MockFunding = PlanSettings["mockFunding"][number];

type Contribution = MockFunding["contributions"][number];

export function sumContributions(contributions: readonly Contribution[]): number {
  return contributions.reduce((total, contribution) => total + contribution.minutes, 0);
}

function findFunding({
  date,
  funding,
}: {
  date: Date;
  funding: readonly MockFunding[];
}): { entry: MockFunding; setAside: number | null } | null {
  const day = toIsoDate(date);
  const mock = funding.find((entry) => entry.date === day);

  if (mock) {
    return { entry: mock, setAside: null };
  }

  for (const entry of funding) {
    const given = entry.contributions.find((contribution) => contribution.date === day);

    if (given) {
      return { entry, setAside: given.minutes };
    }
  }

  return null;
}

/** The planner and Today both read a day's time from here. */
export function getFundedMinutes({
  base,
  date,
  funding,
}: {
  base: number;
  date: Date;
  funding: readonly MockFunding[];
}): number {
  const day = toIsoDate(date);
  const own = funding.find((entry) => entry.date === day);

  const outgoing = funding.reduce(
    (total, entry) =>
      total + (entry.contributions.find((given) => given.date === day)?.minutes ?? 0),
    0,
  );

  const available = Math.max(0, base - outgoing);
  return own ? getMockDayMinutes({ base: available, entry: own }) : available;
}

export function findMockFundingOn({
  date,
  funding,
}: {
  date: Date;
  funding: readonly MockFunding[];
}): { mockDate: string; mockMinutes: number; setAsideMinutes: number } | null {
  const found = findFunding({ date, funding });

  if (!found || found.setAside === null) {
    return null;
  }

  return {
    mockDate: found.entry.date,
    mockMinutes: found.entry.minutes,
    setAsideMinutes: found.setAside,
  };
}

export function getMockFundingStart(entry: MockFunding): string {
  return entry.contributions[0]?.date ?? entry.date;
}

export function listPast({ saved, start }: { saved: MockFunding | undefined; start: string }) {
  return (saved?.contributions ?? []).filter((contribution) => contribution.date < start);
}

export function resolveIdentity({
  after,
  clocks,
  date,
  fullLength,
  resolution,
  source,
}: {
  after: number | null | undefined;
  clocks: readonly MockClock[];
  date: string;
  fullLength: boolean;
  resolution: MockResolution | null;
  source: MockFunding | undefined;
}): MockIdentity {
  const resolved = resolution?.identities.get(date);

  if (resolved) {
    return { day: resolved.day, fullLength };
  }

  const day = source && source.day !== undefined ? source.day : getNextMockDay({ after, clocks });

  return { day, fullLength };
}

function fundMockOn({
  at,
  days,
  minutes,
  past,
  shapes,
  windowStart,
}: {
  at: number;
  days: readonly PlanDay[];
  minutes: number;
  past: number;
  shapes: readonly DayShape[];
  windowStart: number;
}) {
  const own = shapes[at];

  if (!own) {
    return null;
  }

  const window = days
    .slice(windowStart, at)
    .map((item, offset) => ({
      date: item.date,
      shape: shapes[windowStart + offset] ?? item.shape,
    }));

  const spendable = window.reduce((total, item) => total + getSpendable(item.shape), 0);
  const needed = Math.max(0, minutes - getSpendable(own) - past);

  return needed > spendable + PLAN_EPSILON ? null : { needed, spendable, window };
}

function fundWindow({
  needed,
  shapes,
  spendable,
  window,
  windowStart,
}: {
  needed: number;
  shapes: DayShape[];
  spendable: number;
  window: readonly PlanDay[];
  windowStart: number;
}): Contribution[] {
  const factor = spendable > 0 ? Math.min(1, needed / spendable) : 0;

  return window.flatMap((item, offset) => {
    const minutes = getSpendable(item.shape) * factor;

    if (minutes <= PLAN_EPSILON) {
      return [];
    }

    shapes[windowStart + offset] = fundDay({ minutes, shape: item.shape });
    return [{ date: toIsoDate(item.date), minutes }];
  });
}

export type FundedMocks = {
  days: PlanDay[];
  funding: MockFunding[];
  matched: MockFunding[];
  sourced: Set<string>;
  unfunded: UnfundedMove[];
};

export function fundMocks({
  clocks = [],
  cursor,
  days,
  from,
  funding,
  moves,
  promised = new Map(),
  resolution = null,
}: {
  clocks?: readonly MockClock[];
  cursor?: number | null;
  days: readonly PlanDay[];
  from?: string;
  funding: readonly MockFunding[];
  moves: readonly MovedEvent[];
  promised?: LessonDays;
  resolution?: MockResolution | null;
}): FundedMocks {
  const labels = days.map((day) => toIsoDate(day.date));
  const start = labels[0] ?? null;

  const empty = { days: [], funding: [], matched: [], sourced: new Set<string>(), unfunded: [] };

  if (!start) {
    return empty;
  }

  const released = resolution?.released ?? new Set<string>();

  const dates = days.flatMap((day, index) => {
    const date = labels[index] ?? "";
    return findDayMock(day.shape) && !released.has(date) ? [date] : [];
  });

  const fundFrom = from && from > start ? from : start;
  const fromIndex = labels.findIndex((label) => label >= fundFrom);
  const firstFunding = Math.max(0, fromIndex);
  const matches = matchSavedMocks({ dates, moves, saved: funding, start });

  const shapes = days.map((day, index) =>
    index < firstFunding
      ? fundDay({ minutes: sumSavedOn(funding, labels[index]), shape: day.shape })
      : day.shape,
  );

  const entries: MockFunding[] = [];
  const sourced = new Set<string>();
  const unfunded: UnfundedMove[] = [];
  let after = cursor === undefined ? getMockCursor({ saved: funding, start }) : cursor;
  let windowStart = firstFunding;
  let carried: Contribution[] = [];

  days.forEach((day, index) => {
    const found = findDayMock(day.shape);

    if (!found) {
      return;
    }

    const date = labels[index] ?? "";
    const ownDay = { ...day.shape, events: day.shape.events.filter((event) => event !== found) };

    if (released.has(date)) {
      shapes[index] = ownDay;
      return;
    }

    const source = matches.get(date);

    const identity =
      found.mock &&
      resolveIdentity({
        after,
        clocks,
        date,
        fullLength: found.mock.fullLength,
        resolution,
        source,
      });

    const mock = identity
      ? {
          ...found,
          minutes: getClockMinutes({ clocks, fallback: found.minutes, identity }),
          mock: identity,
        }
      : found;

    const past = [...carried, ...listPast({ saved: source, start: fundFrom })];

    keepWindowTeaching({ days, index, labels, promised, shapes, windowStart });

    shapes[index] = ownDay;

    const funded = fundMockOn({
      at: index,
      days,
      minutes: mock.minutes,
      past: sumContributions(past),
      shapes,
      windowStart,
    });

    if (!funded) {
      carried = past;
      unfunded.push({ date, minutes: mock.minutes });
      return;
    }

    const entry: MockFunding = {
      contributions: [...past, ...fundWindow({ ...funded, shapes, windowStart })],
      date,
      ...identity,
      minutes: mock.minutes,
    };

    shapes[index] = {
      ...day.shape,
      events: day.shape.events.map((event) => (event === found ? mock : event)),
      minutes: getMockDayMinutes({ base: day.shape.minutes, entry }),
    };

    entries.push(entry);
    after = identity ? identity.day : after;
    windowStart = Math.max(index + 1, firstFunding);
    carried = [];

    if (source) {
      sourced.add(date);
    }
  });

  return {
    days: days.map((day, index) => ({ ...day, shape: shapes[index] ?? day.shape })),
    funding: entries,
    matched: [...matches.values()],
    sourced,
    unfunded,
  };
}
