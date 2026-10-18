import { toIsoDate } from "./plan-calendar";
import { type PlannedItem } from "./plan-items";

type MockItem = Pick<PlannedItem, "kind" | "scheduledFor" | "status">;

/** The day of the next mock ahead after a change, and the one it was on (see `getNextMockMove`). */
export type NextMockMove = { after: string; before: string };

/** The day of the first mock still to take from `today` on, as an ISO date. */
function findNextMock({
  items,
  today,
}: {
  items: readonly MockItem[];
  today: Date;
}): string | null {
  const days = items.flatMap((item) =>
    item.kind === "mock" &&
    item.status === "todo" &&
    item.scheduledFor &&
    item.scheduledFor >= today
      ? [item.scheduledFor.getTime()]
      : [],
  );

  return days.length > 0 ? toIsoDate(new Date(Math.min(...days))) : null;
}

/**
 * The day the next mock ahead moves to with a change, against the plan the learner sees
 * (`before`), so the card says it instead of the mock just moving: a new daily time spaces the
 * plan's mocks differently (Ana's next one went from 1 Nov to 11 Oct at 3 hours a day). Null
 * when it keeps its day, or either plan has none ahead.
 */
export function getNextMockMove({
  after,
  before,
  today,
}: {
  after: readonly MockItem[];
  before: readonly MockItem[];
  today: Date;
}): NextMockMove | null {
  const [was, now] = [
    findNextMock({ items: before, today }),
    findNextMock({ items: after, today }),
  ];

  return was && now && was !== now ? { after: now, before: was } : null;
}
