import { type UnfundedMove } from "../plan-error-contract";
import {
  type PracticeFunding,
  fundCommittedMocks,
  fundDay,
  getFixedMinutes,
  getMockDayMinutes,
  getRequestedMoves,
} from "./committed-mock-funding";
import { type KeptTeaching, NOTHING_KEPT, keepWindowTeaching } from "./kept-teaching";
import { EPSILON, findDayMock, getSpendable } from "./mock-day";
import {
  type MockClock,
  type MockIdentity,
  type MockResolution,
  getClockMinutes,
  getMockCursor,
  getNextMockDay,
  matchSavedMocks,
} from "./mock-identity";
import { findMockFunding } from "./mock-relocation";
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

/** What else a mock's day keeps beside it, as its funding saves it (`fixedMinutes`); none: absent. */
function getFixedEntry(shape: DayShape): Pick<MockFunding, "fixedMinutes"> {
  const fixedMinutes = getFixedMinutes(shape);
  return fixedMinutes > 0 ? { fixedMinutes } : {};
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

/** The minutes of what else a mock's day keeps beside it: a phase's checkpoint, not a review. */
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
  /** The minimum saved practice reassigned to actual clock growth, for the quoted effect. */
  practiceFunding?: PracticeFunding[];
  /** The saved mocks the run's mocks continue (see `matchSavedMocks`): each counts once. */
  matched: MockFunding[];
  /**
   * The mocks this run moved off a day a phase's checkpoint left without time for them, to the next
   * day that could fund them (see `findRelocation`); the plan saves them (`mockRelocations`).
   */
  relocations: MovedEvent[];
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
  funding,
  kept = NOTHING_KEPT,
  keepSelection = false,
  moves,
  practice,
  requested = new Set(),
  resolution = null,
}: {
  /** Each exam day's mock clock (see `MockClock`); none: mocks keep the length their day gave. */
  clocks?: readonly MockClock[];
  /** The exam day of the mock before these days; absent: the latest the plan saved before them. */
  cursor?: number | null;
  days: readonly PlanDay[];
  /** The funding the plan saved last (see `PlanSettings.mockFunding`). */
  funding: readonly MockFunding[];
  /** The teaching funding never takes (see `getKeptMinutes`); none: every day's time can give. */
  kept?: KeptTeaching;
  keepSelection?: boolean;
  moves: readonly MovedEvent[];
  practice?: ReadonlyMap<string, number>;
  /** The days a learner's change asks mocks to move to: funded there or refused, never relocated. */
  requested?: ReadonlySet<string>;
  resolution?: MockResolution | null;
}): FundedMocks {
  // Each day's ISO date, read once for the whole pass.
  const labels = days.map((day) => toIsoDate(day.date));
  const start = labels[0] ?? null;

  const empty = {
    days: [],
    funding: [],
    matched: [],
    relocations: [],
    sourced: new Set<string>(),
    unfunded: [],
  };

  if (!start) {
    return empty;
  }

  if (keepSelection) {
    return fundCommittedMocks({
      clocks,
      days,
      funding,
      moves: getRequestedMoves({ moves, requested }),
      practice,
    });
  }

  const released = resolution?.released ?? new Set<string>();

  const dates = days.flatMap((day, index) => {
    const date = labels[index] ?? "";
    return findDayMock(day.shape) && !released.has(date) ? [date] : [];
  });

  const matches = matchSavedMocks({ dates, moves, saved: funding, start });
  const shapes = days.map((day) => day.shape);
  const entries: MockFunding[] = [];
  const sourced = new Set<string>();
  const unfunded: UnfundedMove[] = [];
  const relocations: MovedEvent[] = [];
  let after = cursor === undefined ? getMockCursor({ saved: funding, start }) : cursor;
  let windowStart = 0;
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

    const past = [...carried, ...listPast({ saved: source, start })];

    // Each window keeps the teaching its own challenge tests, from where it really starts; a mock
    // its day can't fund beside a phase's checkpoint, or in place of the lessons it tests, moves to
    // the next day that can; a day the learner asked for (`requested`) is funded there or not at all.
    const testsOwnDay = keepWindowTeaching({
      date,
      days,
      index,
      kept,
      labels,
      shapes,
      windowStart,
    });

    shapes[index] = ownDay;

    const funded = findMockFunding({
      days,
      index,
      minutes: mock.minutes,
      ownBlocked: testsOwnDay,
      past: sumContributions(past),
      relocates: (getFixedMinutes(ownDay) > 0 || testsOwnDay) && !requested.has(date),
      shapes,
      windowStart,
    });

    if (!funded) {
      carried = past;
      unfunded.push({ date, minutes: mock.minutes });
      return;
    }

    const at = labels[funded.at] ?? date;

    const entry: MockFunding = {
      contributions: [...past, ...fundWindow({ ...funded, shapes, windowStart })],
      date: at,
      ...identity,
      ...getFixedEntry(funded.own),
      minutes: mock.minutes,
    };

    // On its own day the mock takes its place among the day's events; on another, it joins them.
    const base = funded.at === index ? day.shape : funded.own;

    shapes[funded.at] = {
      ...base,
      events:
        funded.at === index
          ? day.shape.events.map((event) => (event === found ? mock : event))
          : [...base.events, { ...mock, key: `mock:${at}` }],
      minutes: getMockDayMinutes({ base: base.minutes, entry }),
    };

    relocations.push(...(funded.at === index ? [] : [{ from: date, to: at }]));

    entries.push(entry);
    after = identity ? identity.day : after;
    windowStart = funded.at + 1;
    carried = [];

    if (source) {
      sourced.add(at);
    }
  });

  return {
    days: days.map((day, index) => ({ ...day, shape: shapes[index] ?? day.shape })),
    funding: entries,
    matched: [...matches.values()],
    relocations,
    sourced,
    unfunded,
  };
}
