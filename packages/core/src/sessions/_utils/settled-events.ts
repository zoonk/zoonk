import { type PlanItem } from "@zoonk/db";
import { isWeeklyChallengeItem } from "../../checkpoints/_utils/load-weekly-challenge";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { type PlanSettings } from "../../plans/planner/plan-state";

type EventItem = Pick<PlanItem, "kind" | "scheduledFor" | "status">;

/** Start's missed-days settle re-dates these, which changes their date-based keys: a past event, or today's mock that neither the learner moved there nor the plan funded. */
function isRedatedBySettle({
  item,
  kept,
  today,
}: {
  item: EventItem;
  kept: ReadonlySet<string>;
  today: Date;
}): boolean {
  if (item.status !== "todo" || !item.scheduledFor) {
    return false;
  }

  if (item.kind !== "review" && !isWeeklyChallengeItem(item)) {
    return false;
  }

  return (
    item.scheduledFor < today ||
    (item.kind === "mock" &&
      item.scheduledFor.getTime() === today.getTime() &&
      !kept.has(toIsoDate(today)))
  );
}

/** After days away, Today and Start both offer the saved plan's day without the events Start's settle moves. */
export function dropSettledEvents<Item extends EventItem>({
  items,
  settings,
  today,
}: {
  items: readonly Item[];
  settings: Pick<PlanSettings, "mockFunding" | "movedEvents">;
  today: Date;
}): Item[] {
  const kept = new Set([
    ...settings.movedEvents.map((move) => move.to),
    ...settings.mockFunding.map(({ date }) => date),
  ]);

  return items.filter((item) => !isRedatedBySettle({ item, kept, today }));
}
