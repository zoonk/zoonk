import { findDayMock } from "./mock-day";
import { type MockFunding, listPast, resolveIdentity, sumContributions } from "./mock-funding";
import {
  type MockClock,
  type MockResolution,
  getClockMinutes,
  getMockCursor,
} from "./mock-identity";
import { toIsoDate } from "./plan-calendar";
import { PLAN_EPSILON } from "./plan-precision";
import { type PlanDay, type ScheduledEvent } from "./schedule-units";

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

    if (share <= PLAN_EPSILON) {
      return [];
    }

    result[at] = { ...item, minutes: item.minutes - share };
    fundedDays.add(day);
    return [{ date: day, minutes: share }];
  });
}

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
  days: readonly PlanDay[];
  events: readonly ScheduledEvent[];
  funded: readonly MockFunding[];
  resolution?: MockResolution | null;
  saved: readonly MockFunding[];
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

    if (!shape) {
      after = event.mock?.day === undefined ? after : event.mock.day;
      windowStart = date;
      return;
    }

    const { mock: _mock, ...review } = {
      ...event,
      key: `review:${date}`,
      kind: "review" as const,
      minutes: shape.minutes,
      replacesDay: false,
    };

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

    if (needed > spendable + PLAN_EPSILON) {
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
