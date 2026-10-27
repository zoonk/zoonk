import { findMoveTo } from "./moved-events";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { type MovedEvent, type PlanSettings } from "./plan-state";

type MockFunding = PlanSettings["mockFunding"][number];

/**
 * One exam day's mock clock (see `getMockClock`): the half day a regular week's mock sits, and the
 * whole day of a full one. A scheduled mock's real length is its day's clock.
 */
export type MockClock = { day: number | null; fullMinutes: number; minutes: number };

/**
 * Which mock a scheduled one is: the exam day it sits (null for an exam without days) and whether
 * all of it. Its plan, ledger, card and session all read this one.
 */
export type MockIdentity = { day: number | null; fullLength: boolean };

/**
 * What a planning run settled about its mocks on an earlier pass (see `resolvePlannedMocks`): the
 * identity each retained mock takes, and the mocks it doesn't keep, whose days give back their
 * time.
 */
export type MockResolution = {
  identities: ReadonlyMap<string, MockIdentity>;
  released: ReadonlySet<string>;
};

/** A mock's real length: its exam day's clock, or `fallback` without one (a class test's). */
export function getClockMinutes({
  clocks,
  fallback,
  identity,
}: {
  clocks: readonly MockClock[];
  fallback: number;
  identity: MockIdentity;
}): number {
  const clock = clocks.find((entry) => entry.day === identity.day);

  if (!clock) {
    return fallback;
  }

  return identity.fullLength ? clock.fullMinutes : clock.minutes;
}

/**
 * The exam day the next new mock sits: the one after `after` in the order the days take turns, the
 * first day when no mock came before. Mocks alternate days, the first one's first.
 */
export function getNextMockDay({
  after,
  clocks,
}: {
  after: number | null | undefined;
  clocks: readonly MockClock[];
}): number | null {
  const index = after === undefined ? -1 : clocks.findIndex((clock) => clock.day === after);
  return clocks[(index + 1) % Math.max(1, clocks.length)]?.day ?? null;
}

/** The day of the latest mock the plan saved before `start`, which new mocks follow. */
export function getMockCursor({
  saved,
  start,
}: {
  saved: readonly MockFunding[];
  start: string;
}): number | null | undefined {
  return saved
    .filter((entry) => entry.date < start && entry.day !== undefined)
    .toSorted((a, b) => a.date.localeCompare(b.date))
    .at(-1)?.day;
}

/**
 * The saved mock each of a run's mocks (`dates`, in order) continues, each saved one at most once:
 * the one the learner moved to it, as saved on the day it left (see `findMoveTo`), else the one
 * saved on its date (a move the plan already saved there), else, one for one in date
 * order, an upcoming saved mock no other matched (the calendar moved it: a new study day changed
 * the week's event day). What its days already set aside carries over with it, once.
 */
export function matchSavedMocks({
  dates,
  moves,
  saved,
  start,
}: {
  dates: readonly string[];
  moves: readonly MovedEvent[];
  saved: readonly MockFunding[];
  start: string;
}): Map<string, MockFunding> {
  const consumed = new Set<MockFunding>();
  const matches = new Map<string, MockFunding>();

  const take = (date: string, entry: MockFunding | undefined) => {
    if (entry && !consumed.has(entry)) {
      consumed.add(entry);
      matches.set(date, entry);
    }
  };

  const findSaved = (date: string) => saved.find((entry) => entry.date === date);

  // The mock the learner moved continues as itself. Another move to the same day loses it (see
  // `findMoveTo`), so the mock it held is set aside, its credits with it.
  const setAside = (date: string) => {
    const entry = findSaved(date);

    if (entry) {
      consumed.add(entry);
    }
  };

  dates.forEach((date) => {
    const move = findMoveTo({ date, moves });

    if (!move) {
      return;
    }

    const source = findSaved(move.from);

    if (source && !consumed.has(source)) {
      take(date, source);
      setAside(date);
    }

    moves
      .filter((other) => other.to === date && other !== move)
      .forEach((other) => setAside(other.from));
  });

  dates.forEach((date) => {
    if (!matches.has(date)) {
      take(date, findSaved(date));
    }
  });

  const orphans = saved
    .filter((entry) => entry.date >= start && !consumed.has(entry))
    .toSorted((a, b) => a.date.localeCompare(b.date));

  dates.filter((date) => !matches.has(date)).forEach((date, index) => take(date, orphans[index]));

  return matches;
}

/**
 * The scheduled mock a date holds, as its plan saved it: the exam day and whether all of it. Null
 * when the plan saved no mock there, or saved it before mocks had an identity.
 */
export function findScheduledMock({
  date,
  funding,
}: {
  date: string;
  funding: readonly MockFunding[];
}): MockIdentity | null {
  const entry = funding.find((saved) => saved.date === date);

  if (!entry || entry.day === undefined || entry.fullLength === undefined) {
    return null;
  }

  return { day: entry.day, fullLength: entry.fullLength };
}

/** Days before a run's start that a page still shows: the week Today and the Plan open on. */
const PAST_DAYS_SHOWN = 7;

/**
 * The saved mocks before a run's start the plan keeps as they are: the latest (its exam day is what
 * new mocks follow) and those whose day or saved days a page still shows. Their time was spent.
 */
export function listKeptPastFunding({
  saved,
  start,
}: {
  saved: readonly MockFunding[];
  start: string;
}): MockFunding[] {
  const since = toIsoDate(addDays(fromIsoDate(start), -PAST_DAYS_SHOWN));
  const past = saved.filter((entry) => entry.date < start);
  const latest = past.toSorted((a, b) => a.date.localeCompare(b.date)).at(-1);

  return past.filter(
    (entry) =>
      entry === latest ||
      entry.date >= since ||
      entry.contributions.some((contribution) => contribution.date >= since),
  );
}

/**
 * Whether a planning run's retained mocks, in date order, have the identities the order gives them:
 * a mock continuing a saved one (`sourced`) keeps its exam day, a new one takes the day after the
 * mock before it (`getNextMockDay`), and the funding of mocks it doesn't keep (`funded` beside
 * `retained`) is released. Returns the resolution to plan again with, or null when this one holds.
 */
export function resolveRetainedMocks({
  clocks,
  current,
  cursor,
  funded,
  held,
  retained,
  sourced,
}: {
  clocks: readonly MockClock[];
  current: MockResolution | null;
  /** The exam day of the latest mock before the run (see `getMockCursor`). */
  cursor: number | null | undefined;
  /** The dates of the mocks the run's days funded, retained or not. */
  funded: readonly string[];
  /** The dates of every mock the run's plan holds, a class test's short mock included. */
  held: ReadonlySet<string>;
  /** The run's retained mocks, with the identities this pass gave them. */
  retained: readonly ({ date: string } & MockIdentity)[];
  /** The retained mocks that continue a saved one. */
  sourced: ReadonlySet<string>;
}): MockResolution | null {
  const ordered = retained.toSorted((a, b) => a.date.localeCompare(b.date));
  let after = cursor;

  const identities = new Map(
    ordered.map((mock) => {
      const day = sourced.has(mock.date) ? mock.day : getNextMockDay({ after, clocks });
      after = day;
      return [mock.date, { day, fullLength: mock.fullLength }] as const;
    }),
  );

  const released = new Set([
    ...(current?.released ?? []),
    ...funded.filter((date) => !held.has(date)),
  ]);

  const settled =
    ordered.every((mock) => identities.get(mock.date)?.day === mock.day) &&
    released.size === (current?.released.size ?? 0);

  return settled ? null : { identities, released };
}
