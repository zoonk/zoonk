import { type ExistingPlanItem, type PlannedItem } from "./plan-items";

export function listCarriedItemIds({
  held,
  items,
  left,
}: {
  held: ReadonlySet<string>;
  items: readonly Pick<PlannedItem, "id" | "key" | "status">[];
  left: readonly Pick<ExistingPlanItem, "id">[];
}): string[] {
  const kept = new Set(
    items.flatMap((item) =>
      item.id && item.status === "todo" && !held.has(item.key) ? [item.id] : [],
    ),
  );

  return left.flatMap((item) => (kept.has(item.id) ? [item.id] : []));
}
