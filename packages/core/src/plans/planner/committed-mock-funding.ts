import { EPSILON, findDayMock, getSpendable } from "./mock-day";
import { type FundedMocks, type MockFunding } from "./mock-funding";
import { type MockClock, getClockMinutes, matchSavedMocks } from "./mock-identity";
import { toIsoDate } from "./plan-calendar";
import { type MovedEvent } from "./plan-state";
import { type DayShape, type PlanDay } from "./schedule-units";

type Contribution = MockFunding["contributions"][number];

/** Saved practice explicitly reassigned to a mock whose full clock grows on its new date. */
export type PracticeFunding = { contributions: Contribution[]; date: string };

type FundingInput = {
  clocks: readonly MockClock[];
  days: readonly PlanDay[];
  funding: readonly MockFunding[];
  moves: readonly MovedEvent[];
  practice?: ReadonlyMap<string, number>;
};

/** Saved events and banks already include history; only this explicit edit applies again. */
export function getRequestedMoves({
  moves,
  requested,
}: {
  moves: readonly MovedEvent[];
  requested: ReadonlySet<string>;
}): MovedEvent[] {
  return moves.filter((move) => requested.has(move.to));
}

/** A phase challenge keeps its own clock beside a mock; review gives way to it. */
export function getFixedMinutes(shape: DayShape): number {
  return shape.events
    .filter((event) => event.kind !== "review" && event.kind !== "mock" && !event.beside)
    .reduce((sum, event) => sum + event.minutes, 0);
}

/** Funding changes a day's available minutes and its review by the same proportion. */
export function fundDay({ minutes, shape }: { minutes: number; shape: DayShape }): DayShape {
  const spendable = getSpendable(shape);
  const keep = spendable > 0 ? 1 - minutes / spendable : 1;

  return {
    ...shape,
    events: shape.events.map((event) =>
      event.kind === "review" ? { ...event, minutes: event.minutes * keep } : event,
    ),
    minutes: shape.minutes - minutes,
  };
}

/** A fully funded mock plays its exact whole clock, including fixed coevents. */
export function getMockDayMinutes({ base, entry }: { base: number; entry: MockFunding }): number {
  const given = entry.contributions.reduce((sum, contribution) => sum + contribution.minutes, 0);
  const total = entry.minutes + (entry.fixedMinutes ?? 0);
  const needed = Math.max(0, total - base);

  return given >= needed - EPSILON ? Math.max(base, total) : base + Math.min(given, needed);
}

function sumByDate(funding: readonly MockFunding[]): Map<string, number> {
  return funding
    .flatMap((entry) => entry.contributions)
    .reduce(
      (totals, contribution) =>
        totals.set(contribution.date, (totals.get(contribution.date) ?? 0) + contribution.minutes),
      new Map<string, number>(),
    );
}

function listFreeRoom({
  contributed,
  days,
  source,
  until,
}: {
  contributed: ReadonlyMap<string, number>;
  days: readonly PlanDay[];
  source: MockFunding;
  until: Date;
}): Contribution[] {
  const own = new Map(source.contributions.map((entry) => [entry.date, entry.minutes]));
  const window = days.filter((day) => day.date < until && !findDayMock(day.shape));

  // A day continues to fund one bank. Other banks' contributions and remaining time stay theirs.
  return window.flatMap((day) => {
    const date = toIsoDate(day.date);
    const committed = contributed.get(date) ?? 0;
    const minutes = Math.max(0, getSpendable(day.shape) - committed);

    return Math.abs(committed - (own.get(date) ?? 0)) <= EPSILON ? [{ date, minutes }] : [];
  });
}

function takePractice({
  free,
  needed,
  practice,
}: {
  free: readonly Contribution[];
  needed: number;
  practice: ReadonlyMap<string, number>;
}): Contribution[] | null {
  const result = free.toReversed().reduce<{ left: number; contributions: Contribution[] }>(
    (state, day) => {
      const minutes = Math.min(state.left, practice.get(day.date) ?? 0);

      return minutes > EPSILON
        ? {
            contributions: [...state.contributions, { date: day.date, minutes }],
            left: state.left - minutes,
          }
        : state;
    },
    { contributions: [], left: needed },
  );

  return result.left <= EPSILON ? result.contributions : null;
}

function addContributions({
  additions,
  source,
}: {
  additions: readonly Contribution[];
  source: MockFunding;
}): Contribution[] {
  if (additions.length === 0) {
    return source.contributions;
  }

  const totals = new Map(source.contributions.map((entry) => [entry.date, entry.minutes]));

  additions.forEach((entry) =>
    totals.set(entry.date, (totals.get(entry.date) ?? 0) + entry.minutes),
  );

  return [...totals]
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([date, minutes]) => ({ date, minutes }));
}

function moveCommittedMock({
  clocks,
  contributed,
  day,
  days,
  minutes,
  practice,
  source,
}: {
  clocks: readonly MockClock[];
  contributed: Map<string, number>;
  day: PlanDay;
  days: readonly PlanDay[];
  minutes: number;
  practice: ReadonlyMap<string, number>;
  source: MockFunding;
}): { entry: MockFunding; practice: Contribution[] } | null {
  const date = toIsoDate(day.date);
  const fixedMinutes = getFixedMinutes(day.shape);
  const credit = source.contributions.reduce((sum, entry) => sum + entry.minutes, 0);
  const available = day.shape.minutes - (contributed.get(date) ?? 0) - fixedMinutes;

  const needed = Math.max(0, minutes - credit - available);
  const growth = Math.max(0, minutes - source.minutes);
  // A same-clock move leaves every date before its source unchanged, including its banked share.
  const free = listFreeRoom({ contributed, days, source, until: day.date }).filter(
    (part) => growth > EPSILON || part.date >= source.date,
  );

  const room = free.reduce((sum, contribution) => sum + contribution.minutes, 0);
  const extra = Math.max(0, needed - room);
  const given = extra <= growth + EPSILON ? takePractice({ free, needed: extra, practice }) : null;

  if (day.shape.minutes <= 0 || !given) {
    return null;
  }

  const factor = room > 0 ? Math.min(1, needed / room) : 0;

  const additions = [
    ...free.flatMap((entry) =>
      entry.minutes * factor > EPSILON
        ? [{ date: entry.date, minutes: entry.minutes * factor }]
        : [],
    ),
    ...given,
  ];

  additions.forEach((entry) =>
    contributed.set(entry.date, (contributed.get(entry.date) ?? 0) + entry.minutes),
  );

  const { fixedMinutes: _previousFixed, ...saved } = source;
  const identity = findDayMock(day.shape)?.mock;

  return {
    entry: {
      ...saved,
      ...(identity ? { day: source.day ?? null, fullLength: identity.fullLength } : {}),
      ...(fixedMinutes > 0 ? { fixedMinutes } : {}),
      contributions: addContributions({ additions, source }),
      date,
      minutes: identity
        ? getClockMinutes({
            clocks,
            fallback: minutes,
            identity: { ...identity, day: source.day ?? null },
          })
        : minutes,
    },
    practice: given,
  };
}

/** A local move transfers its bank, future contributions included; all other banks stay committed. */
function retainCommittedMocks({
  clocks,
  days,
  funding,
  moves,
  practice = new Map(),
}: FundingInput): Omit<FundedMocks, "days" | "relocations"> {
  const dates = days.flatMap((day) => (findDayMock(day.shape) ? [toIsoDate(day.date)] : []));

  const matches = matchSavedMocks({
    dates,
    moves,
    saved: funding,
    start: days[0] ? toIsoDate(days[0].date) : "",
  });

  const contributed = sumByDate(funding);
  const unfunded: FundedMocks["unfunded"] = [];
  const remainingPractice = new Map(practice);
  const practiceFunding: PracticeFunding[] = [];

  const entries = days.flatMap((day): MockFunding[] => {
    const event = findDayMock(day.shape);

    if (!event) {
      return [];
    }

    const date = toIsoDate(day.date);
    const source = matches.get(date);
    const identity = event.mock && { day: source?.day ?? null, fullLength: event.mock.fullLength };

    const minutes = identity
      ? getClockMinutes({ clocks, fallback: event.minutes, identity })
      : event.minutes;

    const moved =
      source &&
      (source.date === date
        ? { entry: source, practice: [] }
        : moveCommittedMock({
            clocks,
            contributed,
            day,
            days,
            minutes,
            practice: remainingPractice,
            source,
          }));

    if (!moved) {
      unfunded.push({ date, minutes });
      return [];
    }

    moved.practice.forEach((part) =>
      remainingPractice.set(part.date, (remainingPractice.get(part.date) ?? 0) - part.minutes),
    );

    if (moved.practice.length > 0) {
      practiceFunding.push({ contributions: moved.practice, date });
    }

    return [moved.entry];
  });

  const last = days.at(-1);
  const outside = last ? funding.filter((entry) => entry.date > toIsoDate(last.date)) : [];
  const retained = [...entries, ...outside];

  return {
    funding: retained,
    matched: [...matches.values()],
    practiceFunding,
    sourced: new Set(retained.map((entry) => entry.date)),
    unfunded,
  };
}

/** The local edit uses the retained ledgers once, without reopening membership or normal funding. */
export function fundCommittedMocks(input: FundingInput): FundedMocks {
  const committed = retainCommittedMocks(input);
  const deductions = sumByDate(committed.funding);
  const byDate = new Map(committed.funding.map((entry) => [entry.date, entry]));

  const days = input.days.map((day) => {
    const date = toIsoDate(day.date);

    const practice = (committed.practiceFunding ?? [])
      .flatMap((entry) => entry.contributions)
      .filter((entry) => entry.date === date)
      .reduce((sum, entry) => sum + entry.minutes, 0);

    const shape = fundDay({
      minutes: deductions.get(date) ?? 0,
      shape: { ...day.shape, kept: (day.shape.kept ?? 0) - practice },
    });

    const entry = byDate.get(date);
    const mock = findDayMock(shape);

    return {
      ...day,
      shape: {
        ...shape,
        events: shape.events.flatMap((event) => {
          if (event !== mock) {
            return [event];
          }

          return entry ? [{ ...event, minutes: entry.minutes }] : [];
        }),
        minutes: entry ? getMockDayMinutes({ base: shape.minutes, entry }) : shape.minutes,
      },
    };
  });

  return { ...committed, days, relocations: [] };
}
