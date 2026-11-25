import { type ExistingPlanItem } from "./plan-items";

/**
 * Only a written answer shows a written skill, so its test-outs go back to do. A skill can join the
 * written part after the learner tested out of it, when the graph or the notice changes.
 */
export function reopenWrittenTestOuts<Item extends ExistingPlanItem>({
  items,
  unprovenSkillIds,
}: {
  items: readonly Item[];
  unprovenSkillIds: readonly string[];
}): { items: Item[]; reopenedItemIds: string[] } {
  const unproven = new Set(unprovenSkillIds);

  const reopens = (item: Item) =>
    item.status === "testedOut" && item.skillId !== null && unproven.has(item.skillId);

  return {
    items: items.map((item) =>
      reopens(item) ? { ...item, completedAt: null, status: "todo" as const } : item,
    ),
    reopenedItemIds: items.filter((item) => reopens(item)).map((item) => item.id),
  };
}
