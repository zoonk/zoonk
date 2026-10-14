import { type ExistingPlanItem, type PlannedItem } from "./plan-items";

/**
 * The work earlier days left that the day's settling carried: what it kept to do. What it set
 * aside, for lack of time or because the plan's date came, isn't carried (it isn't first in the
 * plan) nor to catch up (see `loadCatchUpItems`): Lucas, a day past his date, read "Behind · 13
 * lessons to catch up" right after moving his date to fit the lessons it had set aside.
 */
export function listCarriedItemIds({
  items,
  left,
}: {
  /** The plan the settling laid out. */
  items: readonly Pick<PlannedItem, "id" | "status">[];
  left: readonly Pick<ExistingPlanItem, "id">[];
}): string[] {
  const kept = new Set(
    items.flatMap((item) => (item.id && item.status === "todo" ? [item.id] : [])),
  );

  return left.flatMap((item) => (kept.has(item.id) ? [item.id] : []));
}
