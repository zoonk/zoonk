import { toIsoDate } from "./plan-calendar";
import { type PlannedItem } from "./plan-items";

type MockItem = Pick<PlannedItem, "kind" | "scheduledFor" | "status">;

export type NextMockMove = { after: string; before: string };

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
