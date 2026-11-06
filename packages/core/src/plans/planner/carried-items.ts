import { type ExistingPlanItem, type PlannedItem } from "./plan-items";

export function listCarriedItemIds({
  items,
  left,
}: {
  items: readonly Pick<PlannedItem, "id" | "status">[];
  left: readonly Pick<ExistingPlanItem, "id">[];
}): string[] {
  const kept = new Set(
    items.flatMap((item) => (item.id && item.status === "todo" ? [item.id] : [])),
  );

  return left.flatMap((item) => (kept.has(item.id) ? [item.id] : []));
}
