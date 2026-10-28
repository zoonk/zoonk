import { type UnfundedMove } from "../plan-error-contract";
import { type LessonDays, keepWindowTeaching } from "./kept-teaching";
import {
  EPSILON,
  findDayMock,
  fundDay,
  getMockDayMinutes,
  getSpendable,
  sumSavedOn,
} from "./mock-day";
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
import { type MovedEvent, type PlanSettings } from "./plan-state";
import { type DayShape, type PlanDay } from "./schedule-units";

/** One mock's funding, as the plan saved it (see `PlanSettings.mockFunding`). */
export type MockFunding = PlanSettings["mockFunding"][number];

type Contribution = MockFunding["contributions"][number];

export function sumContributions(contributions: readonly Contribution[]): number {
  return contributions.reduce((total, contribution) => total + contribution.minutes, 0);
}

/** The mock a date holds, or the mock it sets time aside for, with how much. */
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

/**
 * A date's study minutes once the plan's mocks are funded: a mock's day holds the mock's whole
 * length (see `getMockDayMinutes`), a day that sets time aside for one keeps the rest of its planned minutes (`base`), any
 * other day its planned minutes. The planner and Today both read a day's time from here.
 */
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

/**
 * The mock a day sets time aside for, its length, and the minutes this day gives it, so the plan
 * and Today can say why the day is lighter. Null on a mock's own day and on days that fund none.
 */
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

/** The first day a mock's funding sets time aside, or its own day when none does. */
export function getMockFundingStart(entry: MockFunding): string {
  return entry.contributions[0]?.date ?? entry.date;
}

/** What days before the run's first set aside for a mock, as they did: they're never planned again. */
export function listPast({ saved, start }: { saved: MockFunding | undefined; start: string }) {
  return (saved?.contributions ?? []).filter((contribution) => contribution.date < start);
}

/** A scheduled mock's identity on this pass (see `MockResolution`, `matchSavedMocks`). */
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

/**
 * What funding a mock on day `at` takes (see `fundMocks`): the days of its window since the last
 * mock as funding left them (`shapes`: a left-out mock's day is an ordinary day again), what they
 * must give besides its own day's time and what earlier days already set aside (`past`), and its
 * day's shape. Null when they can't give it.
 */
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

  return needed > spendable + EPSILON ? null : { needed, spendable, window };
}

/**
 * The days of a mock's window giving `needed` minutes, each the same share of the time it can
 * give (see `getSpendable`): their shapes lighter (in `shapes`), and what each gave.
 */
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

    if (minutes <= EPSILON) {
      return [];
    }

    shapes[windowStart + offset] = fundDay({ minutes, shape: item.shape });
    return [{ date: toIsoDate(item.date), minutes }];
  });
}

/** What `fundMocks` settles for a run's days. */
export type FundedMocks = {
  days: PlanDay[];
  funding: MockFunding[];
  /** The saved mocks the run's mocks continue (see `matchSavedMocks`): each counts once. */
  matched: MockFunding[];
  /** The mocks whose identity continues a saved one's. */
  sourced: Set<string>;
  /** The mocks the days before them can't fund, at their real length: not planned. */
  unfunded: UnfundedMove[];
};

/**
 * The plan's days with their mocks funded. Each scheduled mock is one exam day's (see
 * `MockIdentity`): the one it continues keeps its day, a new one takes the day after the mock
 * before it, and its real length is that day's clock, half of it or, in the final stretch, all of
 * it. Its own day's time counts toward it, and the study days before it since the last mock set
 * the rest aside, each the same share of the time it can give (see `getSpendable`), after what past
 * days already set aside for the mock it continues, as they saved it. A mock whose window can't
 * fund it isn't planned: no day is squeezed to fit it, and its days (and what they already set
 * aside) fund the next one. A mock a run doesn't keep (`resolution.released`) gives its day back.
 * Returns the funding the plan saves (see `PlanSettings.mockFunding`), so Today reads the same
 * days (see `getFundedMinutes`).
 */
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
  /** Each exam day's mock clock (see `MockClock`); none: mocks keep the length their day gave. */
  clocks?: readonly MockClock[];
  /** The exam day of the mock before these days; absent: the latest the plan saved before them. */
  cursor?: number | null;
  days: readonly PlanDay[];
  /**
   * The first day whose time funding may take (an ISO date): a run that keeps this week as saved
   * starts after it, so this week's days give a mock what they set aside before and no more.
   * Funded again, a mock moved to a longer day took this week's whole time on top of the lessons
   * the run kept there. Absent: from the first of `days`.
   */
  from?: string;
  /** The funding the plan saved last (see `PlanSettings.mockFunding`). */
  funding: readonly MockFunding[];
  moves: readonly MovedEvent[];
  /** The promised lesson's teaching, which funding never takes; none: every day's time can give. */
  promised?: LessonDays;
  resolution?: MockResolution | null;
}): FundedMocks {
  // Each day's ISO date, read once for the whole pass.
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

  // The days before `from` keep what they set aside before.
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

    // Each window keeps the promised lesson's teaching, from where it really starts.
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
