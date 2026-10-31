import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { type MovedEvent, type PlanSettings } from "./plan-state";

type MockFunding = PlanSettings["mockFunding"][number];

export type MockClock = { day: number | null; fullMinutes: number; minutes: number };

export type MockIdentity = { day: number | null; fullLength: boolean };

export type MockResolution = {
  identities: ReadonlyMap<string, MockIdentity>;
  released: ReadonlySet<string>;
};

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

  dates.forEach((date) => {
    const move = moves.find((entry) => entry.to === date);
    const source = move && findSaved(move.from);

    if (source && !consumed.has(source)) {
      take(date, source);

      const own = findSaved(date);

      if (own) {
        consumed.add(own);
      }
    }
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

const PAST_DAYS_SHOWN = 7;

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
  cursor: number | null | undefined;
  funded: readonly string[];
  held: ReadonlySet<string>;
  retained: readonly ({ date: string } & MockIdentity)[];
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
