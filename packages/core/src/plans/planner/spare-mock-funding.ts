import { EPSILON, findDayMock } from "./mock-day";
import { type MockFunding, listPast, resolveIdentity, sumContributions } from "./mock-funding";
import {
  type MockClock,
  type MockResolution,
  getClockMinutes,
  getMockCursor,
} from "./mock-identity";
import { toIsoDate } from "./plan-calendar";
import { type PlanDay, type ScheduledEvent } from "./schedule-units";

/** The review days since the last mock before `date` that fund no mock yet, and their time. */
function listReviewWindow({
  date,
  fundedDays,
  result,
  windowStart,
}: {
  date: string;
  fundedDays: ReadonlySet<string>;
  result: readonly ScheduledEvent[];
  windowStart: string;
}) {
  const window = result.flatMap((item, at) => {
    const day = toIsoDate(item.date);

    return item.kind === "review" && day > windowStart && day < date && !fundedDays.has(day)
      ? [{ at, day, item }]
      : [];
  });

  return { spendable: window.reduce((total, entry) => total + entry.item.minutes, 0), window };
}

/**
 * The review days of a spare mock's window giving `needed` minutes, each the same share of its
 * review (in `result`), and what each gave; they fund no other mock after.
 */
function fundReviews({
  fundedDays,
  needed,
  result,
  spendable,
  window,
}: {
  fundedDays: Set<string>;
  needed: number;
  result: ScheduledEvent[];
  spendable: number;
  window: readonly { at: number; day: string; item: ScheduledEvent }[];
}): MockFunding["contributions"] {
  const factor = spendable > 0 ? Math.min(1, needed / spendable) : 0;

  return window.flatMap(({ at, day, item }) => {
    const share = item.minutes * factor;

    if (share <= EPSILON) {
      return [];
    }

    result[at] = { ...item, minutes: item.minutes - share };
    fundedDays.add(day);
    return [{ date: day, minutes: share }];
  });
}

/**
 * The plan's events with the mocks added once its lessons end early funded too (see
 * `addSpareMocks`): each takes a review day's place, so it holds that day's time and the rest of its
 * real length (its exam day's whole clock, the day after the mock before it, or the one it
 * continues) comes from the review days since the last mock, never from a day with lessons. A spare
 * mock those days can't fund stays the review it was. Days already funding a mock (see
 * `fundMocks`) give nothing more. Returns the funding to save beside `fundMocks`'.
 */
export function fundSpareMocks({
  clocks = [],
  days,
  events,
  funded,
  resolution = null,
  saved,
  start,
}: {
  clocks?: readonly MockClock[];
  /** The plan's funded days: a spare mock's day holds no mock of its own, only its review's time. */
  days: readonly PlanDay[];
  events: readonly ScheduledEvent[];
  /** What `fundMocks` funded in this run. */
  funded: readonly MockFunding[];
  resolution?: MockResolution | null;
  /** The saved mocks no earlier pass continued (see `matchSavedMocks`). */
  saved: readonly MockFunding[];
  /** The run's first day. */
  start: Date;
}): { events: ScheduledEvent[]; funding: MockFunding[]; sourced: Set<string> } {
  const fundedDays = new Set([
    ...funded.map((entry) => entry.date),
    ...funded.flatMap((entry) => entry.contributions.map((contribution) => contribution.date)),
  ]);

  const spareDays = new Map(
    days.flatMap((day) => (findDayMock(day.shape) ? [] : [[toIsoDate(day.date), day.shape]])),
  );

  const result = [...events];
  const entries: MockFunding[] = [];
  const sourced = new Set<string>();
  const consumed = new Set<MockFunding>();
  let after = getMockCursor({ saved, start: toIsoDate(start) });
  let windowStart = "";

  result.forEach((event, index) => {
    const date = toIsoDate(event.date);

    if (event.kind !== "mock") {
      return;
    }

    const shape = spareDays.get(date);

    // A mock the day pass placed (see `fundMocks`) closes the window.
    if (!shape) {
      after = event.mock?.day === undefined ? after : event.mock.day;
      windowStart = date;
      return;
    }

    // The review it took the place of, which it gives back when it isn't planned.
    const { mock: _mock, ...review } = {
      ...event,
      key: `review:${date}`,
      kind: "review" as const,
      minutes: shape.minutes,
      replacesDay: false,
    };

    // A day that funds another mock can't also hold one: it stays the review it was.
    if (fundedDays.has(date)) {
      result[index] = review;
      return;
    }

    const source = saved.find((entry) => entry.date === date && !consumed.has(entry));

    const identity = resolveIdentity({ after, clocks, date, fullLength: true, resolution, source });

    const minutes = getClockMinutes({ clocks, fallback: event.minutes, identity });
    const past = listPast({ saved: source, start: toIsoDate(start) });

    const { spendable, window } = listReviewWindow({ date, fundedDays, result, windowStart });
    const needed = Math.max(0, minutes - review.minutes - sumContributions(past));

    if (needed > spendable + EPSILON) {
      result[index] = review;
      return;
    }

    const future = fundReviews({ fundedDays, needed, result, spendable, window });

    result[index] = { ...event, minutes, mock: identity };
    entries.push({ contributions: [...past, ...future], date, ...identity, minutes });
    fundedDays.add(date);
    after = identity.day;
    windowStart = date;

    if (source) {
      consumed.add(source);
      sourced.add(date);
    }
  });

  return { events: result, funding: entries, sourced };
}
